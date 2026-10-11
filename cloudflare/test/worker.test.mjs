import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { createWorker } from '../src/routes.mjs';
import { MODEL } from '../shared/core.mjs';

// Public, deterministic fixtures only. These are not usable production secrets.
const TOKEN = '0123456789abcdef'.repeat(4);
const ENV = {
  SERVICE_ACCESS_TOKEN: TOKEN,
  SERVICE_ORIGIN: 'https://nrs.example.test',
  OPENROUTER_API_KEY: 'test-provider-key-not-real',
};
const CTX = { waitUntil() {}, passThroughOnException() {}, props: {} };
function request(path, { method = 'GET', auth = TOKEN, origin, body, headers = {} } = {}) {
  const h = new Headers({ Host: new URL(ENV.SERVICE_ORIGIN).host, ...headers });
  if (auth !== null) h.set('Authorization', `Bearer ${auth}`);
  if (origin !== undefined) h.set('Origin', origin);
  if (body !== undefined && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
  return new Request(`${ENV.SERVICE_ORIGIN}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const args = { selected_text: 'Selected sample.', approved_for_this_call: true };
async function callMcp(method, params = {}, id = 1) {
  return worker.fetch(request('/mcp', {
    method: 'POST',
    headers: { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-03-26' },
    body: { jsonrpc: '2.0', id, method, params },
  }), ENV, CTX);
}
async function rpcJson(response) {
  const text = await response.text();
  if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const line = text.split('\n').find(line => line.startsWith('data: '));
    assert.ok(line, `Missing SSE data, HTTP ${response.status}`);
    return JSON.parse(line.slice(6));
  }
  return JSON.parse(text);
}

for (const path of ['/v1/configuration', '/v1/rewrite', '/mcp', '/unknown']) {
  test(`authentication required before ${path}`, async () => {
    for (const auth of [null, 'wrong', ENV.OPENROUTER_API_KEY]) {
      const response = await worker.fetch(request(path, {
        auth,
        headers: { 'x-openai-subject': 'pretend-user', 'oai-subject': 'pretend-user' },
      }), ENV, CTX);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.ok(response.headers.has('WWW-Authenticate'));
      const text = await response.text();
      assert.ok(!text.includes(TOKEN));
      assert.ok(!text.includes(ENV.OPENROUTER_API_KEY));
    }
  });
}

test('fails closed without secure and distinct server credentials', async () => {
  for (const env of [
    { ...ENV, SERVICE_ACCESS_TOKEN: '' },
    { ...ENV, SERVICE_ACCESS_TOKEN: 'short' },
    { ...ENV, SERVICE_ACCESS_TOKEN: undefined },
    { ...ENV, OPENROUTER_API_KEY: TOKEN },
    { ...ENV, OPENROUTER_API_KEY: ` ${TOKEN} ` },
    { ...ENV, SERVICE_ORIGIN: undefined },
    { ...ENV, SERVICE_ORIGIN: 'http://nrs.example.test' },
    { ...ENV, SERVICE_ORIGIN: `${ENV.SERVICE_ORIGIN}/` },
  ]) {
    const response = await worker.fetch(request('/v1/configuration'), env, CTX);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'error', error: 'service_unavailable' });
  }
});

test('validates exact Origin and deployment origin; no wildcard CORS', async () => {
  for (const origin of ['https://evil.example', 'null', 'https://nrs.example.test:444', 'http://nrs.example.test', 'not-a-url']) {
    assert.equal((await worker.fetch(request('/v1/configuration', { origin }), ENV, CTX)).status, 403);
  }
  const wrongHost = new Request('https://evil.example/v1/configuration', { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal((await worker.fetch(wrongHost, ENV, CTX)).status, 403);
  for (const origin of [undefined, ENV.SERVICE_ORIGIN]) {
    const response = await worker.fetch(request('/v1/configuration', { origin }), ENV, CTX);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
});

test('configuration status is authenticated, redacted, and makes no network call', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network must not be called'); };
  try {
    const response = await worker.fetch(request('/v1/configuration'), ENV, CTX);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.connection, 'configured_unverified');
    assert.equal(data.model, MODEL);
    assert.ok(!JSON.stringify(data).includes(ENV.OPENROUTER_API_KEY));
    assert.ok(!JSON.stringify(data).includes(TOKEN));
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects unsupported REST methods, media, and invalid JSON', async () => {
  const wrongMethod = await worker.fetch(request('/v1/configuration', { method: 'POST' }), ENV, CTX);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('Allow'), 'GET');
  const wrongMedia = await worker.fetch(request('/v1/rewrite', { method: 'POST', body: args, headers: { 'Content-Type': 'text/plain' } }), ENV, CTX);
  assert.equal(wrongMedia.status, 415);
  const invalid = new Request(`${ENV.SERVICE_ORIGIN}/v1/rewrite`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal((await worker.fetch(invalid, ENV, CTX)).status, 400);
});

test('REST core rejects missing approval, blank selection, and unknown fields without network', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('Network must not be called'); };
  try {
    for (const body of [null, {}, { ...args, approved_for_this_call: false }, { ...args, selected_text: ' ' }, { ...args, extra: 'unapproved' }]) {
      const response = await worker.fetch(request('/v1/rewrite', { method: 'POST', body }), ENV, CTX);
      assert.equal((await response.json()).error, 'invalid_arguments');
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('REST forwards only the OpenRouter key upstream and returns complete text', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(init.headers.Authorization, `Bearer ${ENV.OPENROUTER_API_KEY}`);
    assert.ok(!JSON.stringify(init).includes(TOKEN));
    const body = JSON.parse(init.body);
    assert.equal(body.model, MODEL);
    assert.equal(body.messages[1].content, args.selected_text);
    assert.equal(init.signal, undefined);
    assert.equal(body.max_tokens, undefined);
    return Response.json({ model: MODEL, choices: [{ finish_reason: 'stop', message: { content: 'Rewritten sample.' } }] });
  };
  try {
    const response = await worker.fetch(request('/v1/rewrite', { method: 'POST', body: args }), ENV, CTX);
    const result = await response.json();
    assert.equal(result.status, 'complete');
    assert.equal(result.text, 'Rewritten sample.');
    assert.equal(result.fidelity, 'unverified');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('unexpected exceptions are sanitized with no automatic retry', async () => {
  const fake = createWorker({
    configurationStatus() { throw new Error(`SECRET ${TOKEN}`); },
    rewriteSelectedText() { throw new Error('not reached'); },
    handleMcp() { throw new Error('not reached'); },
  });
  const response = await fake.fetch(request('/v1/configuration'), ENV, CTX);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { status: 'error', error: 'internal_error', automatic_retry: false });
});

test('real pinned MCP handler initializes and lists the two tools', async () => {
  const initialized = await callMcp('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'public-package-tests', version: '1' } });
  assert.equal(initialized.status, 200);
  const init = await rpcJson(initialized);
  assert.equal(init.result.serverInfo.name, 'No Restrictions The Final Step Skill');
  const response = await callMcp('tools/list');
  assert.equal(response.status, 200);
  const data = await rpcJson(response);
  assert.deepEqual(data.result.tools.map(t => t.name).sort(), ['getConfigurationStatus', 'rewriteSelectedText']);
  const rewrite = data.result.tools.find(t => t.name === 'rewriteSelectedText');
  assert.equal(rewrite.inputSchema.additionalProperties, false);
  assert.equal(rewrite.inputSchema.properties.selected_text.maxLength, undefined);
  assert.equal(rewrite.annotations.idempotentHint, false);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('real MCP configuration tool redacts credentials', async () => {
  const response = await callMcp('tools/call', { name: 'getConfigurationStatus', arguments: {} });
  const data = await rpcJson(response);
  assert.equal(data.result.isError, false);
  assert.equal(data.result.structuredContent.connection, 'configured_unverified');
  assert.ok(!JSON.stringify(data).includes(TOKEN));
  assert.ok(!JSON.stringify(data).includes(ENV.OPENROUTER_API_KEY));
});

test('real MCP rewrite returns text with metadata, and requires per-call approval', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ model: MODEL, choices: [{ finish_reason: 'stop', message: { content: 'MCP rewrite.' } }] });
  };
  try {
    const response = await callMcp('tools/call', { name: 'rewriteSelectedText', arguments: args });
    const data = await rpcJson(response);
    assert.equal(data.result.isError, false);
    assert.equal(data.result.content[0].text, 'MCP rewrite.');
    assert.equal(data.result.structuredContent.status, 'complete');
    assert.equal(data.result.structuredContent.text, undefined);
    for (const invalid of [{ selected_text: 'sample' }, { ...args, extra: 'unexpected' }]) {
      const rejected = await rpcJson(await callMcp('tools/call', { name: 'rewriteSelectedText', arguments: invalid }));
      assert.ok(rejected.error || rejected.result?.isError);
    }
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('MCP exposes uncertain/incomplete outcomes as errors without partial output', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ model: MODEL, choices: [{ finish_reason: 'length', message: { content: 'PRIVATE PARTIAL OUTPUT' } }] });
  try {
    const data = await rpcJson(await callMcp('tools/call', { name: 'rewriteSelectedText', arguments: args }));
    assert.equal(data.result.isError, true);
    assert.equal(data.result.structuredContent.status, 'incomplete');
    assert.equal(data.result.structuredContent.automatic_retry, false);
    assert.ok(!JSON.stringify(data).includes('PRIVATE PARTIAL OUTPUT'));
  } finally { globalThis.fetch = originalFetch; }
});


test('query strings are rejected before any provider or MCP work', async () => {
  let calls = 0;
  const fake = createWorker({
    configurationStatus() { calls++; return {}; },
    rewriteSelectedText() { calls++; return {}; },
    handleMcp() { calls++; return new Response('{}'); },
  });
  for (const path of ['/v1/configuration?token=example', '/v1/rewrite?extra=value', '/mcp?extra=value']) {
    const response = await fake.fetch(request(path, { method: 'POST', body: args }), ENV, CTX);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: 'error', error: 'query_not_supported' });
  }
  assert.equal(calls, 0);
});
