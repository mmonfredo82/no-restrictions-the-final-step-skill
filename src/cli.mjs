#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildRequest, rewriteSelectedText} from './core.mjs';
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
const help = `No Restrictions The Final Step Skill\n\nUsage:\n  node src/cli.mjs --prepare [--input FILE]\n  node src/cli.mjs --approved [--json] [--input FILE]\n\nWithout --input, read UTF-8 text from standard input. --prepare never contacts\nOpenRouter. --approved explicitly authorizes one paid request containing only\nthat selected text and the fixed prompt. Set OPENROUTER_API_KEY securely in\nthe process environment. No key is accepted as a command-line argument.\n\nReview facts, numeric written forms, quotations and layout before using output.\n`;
export async function runCli(argv, {env = process.env, fetchImpl = globalThis.fetch, readInput, stdout = text => process.stdout.write(text), stderr = text => process.stderr.write(text)} = {}) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) { stdout(help); return 0; }
  let prepare = false, approved = false, json = false, file;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--prepare' && !prepare) prepare = true;
    else if (flag === '--approved' && !approved) approved = true;
    else if (flag === '--json' && !json) json = true;
    else if (flag === '--input' && !file && argv[i + 1] && !argv[i + 1].startsWith('--')) file = argv[++i];
    else { stderr('Invalid arguments. Run with --help.\n'); return 2; }
  }
  if (prepare === approved) { stderr('Choose --prepare (offline) or --approved (one paid request).\n'); return 2; }
  let selectedText;
  try {
    selectedText = readInput ? await readInput(file) : file ? await readFile(file, 'utf8') : await readStdin();
    if (!selectedText.trim()) throw new Error('empty');
  } catch { stderr('Unable to read nonempty UTF-8 input.\n'); return 2; }
  if (prepare) { stdout(JSON.stringify(buildRequest(selectedText), null, 2) + '\n'); return 0; }
  const result = await rewriteSelectedText({selected_text: selectedText, approved_for_this_call: true}, env, {fetchImpl});
  if (result.status !== 'complete') { stderr(JSON.stringify(result) + '\n'); return 1; }
  stdout(json ? JSON.stringify(result) + '\n' : result.text);
  stderr('Provider completion received. Fidelity is unverified; review against the original before use.\n');
  return 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
