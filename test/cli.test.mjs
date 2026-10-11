import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {runCli} from '../src/cli.mjs';
import {buildRequest, MODEL} from '../src/core.mjs';
const root = new URL('../', import.meta.url);
const text = 'Fictional input: 16 pieces.\r\nCafé\u200d\n';
function harness(extra = {}) {
  let out = '', err = '';
  return {opts: {readInput: async () => text, stdout: s => out += s, stderr: s => err += s, ...extra}, get out() {return out;}, get err() {return err;}};
}
test('offline JS CLI prepares without credentials or network', async () => {
  const h = harness({env: {}, fetchImpl: () => {throw new Error('unexpected network');}});
  assert.equal(await runCli(['--prepare'], h.opts), 0);
  assert.deepEqual(JSON.parse(h.out), buildRequest(text));
});
test('actual stdin and file preparation paths work', () => {
  const stdin = spawnSync(process.execPath, ['src/cli.mjs', '--prepare'], {cwd: root, input: text, encoding: 'utf8'});
  assert.equal(stdin.status, 0, stdin.stderr);
  assert.deepEqual(JSON.parse(stdin.stdout), buildRequest(text));
  const file = spawnSync(process.execPath, ['src/cli.mjs', '--prepare', '--input', 'examples/selected-text.txt'], {cwd: root, encoding: 'utf8'});
  assert.equal(file.status, 0, file.stderr);
  assert(JSON.parse(file.stdout).messages[1].content.includes('16 essays'));
});
test('offline Python builder matches JS, including exact CRLF and Unicode', () => {
  const python = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['skill/scripts/build_request.py'], {cwd: root, input: text, encoding: 'utf8'});
  assert.equal(python.status, 0, python.stderr);
  assert.deepEqual(JSON.parse(python.stdout), buildRequest(text));
});
test('CLI requires explicit single mode and rejects unknown flags', async () => {
  for (const argv of [[], ['--input', 'file'], ['--prepare', '--approved'], ['--approved', '--api-key', 'secret'], ['--approved', '--input'], ['--approved', '--approved']]) {
    const h = harness({fetchImpl: () => {throw new Error('unexpected network');}});
    assert.equal(await runCli(argv, h.opts), 2);
  }
});
test('approved CLI emits only completed output, metadata on request, and review reminder', async () => {
  for (const flags of [['--approved'], ['--approved', '--json']]) {
    const h = harness({env: {OPENROUTER_API_KEY: 'mock'}, fetchImpl: async () => Response.json({model: MODEL, choices: [{finish_reason: 'stop', message: {content: 'Complete mock.'}}]})});
    assert.equal(await runCli(flags, h.opts), 0);
    assert(h.err.includes('unverified'));
    assert.equal(flags.includes('--json') ? JSON.parse(h.out).text : h.out, 'Complete mock.');
  }
});
test('CLI error never becomes output or automatic retry', async () => {
  let calls = 0;
  const h = harness({env: {OPENROUTER_API_KEY: 'mock'}, fetchImpl: async () => {calls++; throw new Error('SECRET_SENTINEL');}});
  assert.equal(await runCli(['--approved'], h.opts), 1);
  assert.equal(calls, 1);
  assert.equal(h.out, '');
  assert.equal(JSON.parse(h.err).status, 'uncertain');
  assert(!h.err.includes('SECRET_SENTINEL'));
});
