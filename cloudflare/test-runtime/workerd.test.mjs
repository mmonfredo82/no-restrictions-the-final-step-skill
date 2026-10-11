import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { MODEL } from '../shared/core.mjs';

// All credentials and provider results are inert fixtures. No live network is used.
const token = '0123456789abcdef'.repeat(4);
// Miniflare's dispatch proxy sets Host to loopback; use an approved local origin.
const origin = 'http://127.0.0.1';
const headers = {
  Host: new URL(origin).host,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};
async function parseRpc(response) {
  const text = await response.text();
  if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
    return JSON.parse(text.split('\n').find(line => line.startsWith('data: ')).slice(6));
  }
  return JSON.parse(text);
}

test('bundled Worker runs in workerd: authentication, configuration, MCP, and mocked rewrite', async () => {
  let providerCalls = 0;
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    scriptPath: 'dist/worker.js',
    compatibilityDate: '2026-10-11',
    compatibilityFlags: ['nodejs_compat'],
    bindings: {
      SERVICE_ORIGIN: origin,
      SERVICE_ACCESS_TOKEN: token,
      OPENROUTER_API_KEY: 'inert-test-provider-key',
    },
    outboundService: async request => {
      providerCalls++;
      assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(request.headers.get('Authorization'), 'Bearer inert-test-provider-key');
      const body = await request.json();
      assert.equal(body.model, MODEL);
      assert.equal(body.messages[1].content, 'Selected workerd text.');
      assert.ok(!JSON.stringify(body).includes(token));
      return Response.json({ model: MODEL, choices: [{ finish_reason: 'stop', message: { content: 'Workerd rewrite.' } }] });
    },
  }));
  try {
    assert.equal((await mf.dispatchFetch(`${origin}/v1/configuration`)).status, 401);
    assert.equal((await mf.dispatchFetch(`${origin}/mcp`)).status, 401);
    const status = await mf.dispatchFetch(`${origin}/v1/configuration`, { headers });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).connection, 'configured_unverified');
    assert.equal(providerCalls, 0);
    const callMcp = (method, params = {}) => mf.dispatchFetch(`${origin}/mcp`, {
      method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const init = await callMcp('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'workerd-fixture', version: '1' } });
    const initResult = await parseRpc(init);
    assert.equal(init.status, 200, JSON.stringify(initResult));
    assert.equal(initResult.result.serverInfo.name, 'No Restrictions The Final Step Skill');
    const list = await parseRpc(await callMcp('tools/list'));
    assert.deepEqual(list.result.tools.map(tool => tool.name).sort(), ['getConfigurationStatus', 'rewriteSelectedText']);
    const rewritten = await parseRpc(await callMcp('tools/call', {
      name: 'rewriteSelectedText',
      arguments: { selected_text: 'Selected workerd text.', approved_for_this_call: true },
    }));
    assert.equal(rewritten.result.isError, false);
    assert.equal(rewritten.result.content[0].text, 'Workerd rewrite.');
    assert.equal(providerCalls, 1);
    const refusedOrigin = await mf.dispatchFetch(`${origin}/v1/configuration`, {
      headers: { ...headers, Origin: 'https://evil.example' },
    });
    assert.equal(refusedOrigin.status, 403);
  } finally {
    await mf.dispose();
  }
});
