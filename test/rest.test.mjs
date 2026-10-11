import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import http from 'node:http';
import {handleRestRequest, authenticationConfigured} from '../src/rest.mjs';
import {createService} from '../src/server.mjs';
import {MODEL} from '../src/core.mjs';
const token = 'fictional_test_token_for_tests_only_01234567890123456789';
const env = {SERVICE_ACCESS_TOKEN: token, OPENROUTER_API_KEY: 'mock-provider', SERVICE_ORIGIN: 'http://127.0.0.1:8787'};
const args = {selected_text: '16 fictional entries.', approved_for_this_call: true};
const request = (path, {headers = {}, body, method = body ? 'POST' : 'GET'} = {}) => new Request(env.SERVICE_ORIGIN + path, {method, headers: {authorization: `Bearer ${token}`, ...(body ? {'content-type': 'application/json'} : {}), ...headers}, ...(body ? {body: JSON.stringify(body)} : {})});
test('REST auth fails closed and ignores spoofed identity header', async () => {
  for (const secrets of [{}, {...env, SERVICE_ACCESS_TOKEN: 'short'}, {...env, OPENROUTER_API_KEY: token}, {...env, OPENROUTER_API_KEY: ` ${token} `}]) {
    assert.equal(authenticationConfigured(secrets), false);
    assert.equal((await handleRestRequest(request('/status'), secrets)).status, 503);
  }
  for (const headers of [{authorization: ''}, {authorization: 'Bearer wrong'}, {authorization: '', 'oai-authenticated-user-id': 'owner'}, {authorization: `Basic ${token}`}]) {
    assert.equal((await handleRestRequest(request('/rewrite', {headers, body: args}), env)).status, 401);
  }
});
test('REST status is authenticated, secret-free and offline', async () => {
  const r = await handleRestRequest(request('/status'), env, {fetchImpl: () => {throw new Error('unexpected');}});
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.processing_prompt_version, '5');
  assert(!JSON.stringify(data).includes(env.OPENROUTER_API_KEY));
});
test('REST rejects cross-origin, query credential use, malformed input and non-JSON', async () => {
  assert.equal((await handleRestRequest(request('/status', {headers: {origin: 'https://evil.invalid'}}), env)).status, 403);
  assert.equal((await handleRestRequest(request('/status?token=x'), env)).status, 400);
  assert.equal((await handleRestRequest(request('/rewrite'), env)).status, 405);
  assert.equal((await handleRestRequest(request('/rewrite', {body: args, headers: {'content-type': 'text/plain'}}), env)).status, 415);
  assert.equal((await handleRestRequest(request('/rewrite', {body: {...args, history: 'no'}}), env)).status, 400);
  assert.equal((await handleRestRequest(new Request(env.SERVICE_ORIGIN + '/rewrite', {method: 'POST', headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json'}, body: 'invalid'}), env)).status, 400);
});
test('REST success and incomplete errors use correct HTTP status, withholding partials', async () => {
  for (const finish of ['stop', 'length']) {
    const r = await handleRestRequest(request('/rewrite', {body: args}), env, {fetchImpl: async () => Response.json({model: MODEL, choices: [{finish_reason: finish, message: {content: 'OUTPUT_SENTINEL'}}]})});
    assert.equal(r.status, finish === 'stop' ? 200 : 502);
    const body = await r.text();
    assert.equal(body.includes('OUTPUT_SENTINEL'), finish === 'stop');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  }
});
test('Node server starts and serves a real loopback request; enforces Host before inference', async t => {
  let calls = 0;
  const server = createService(env, {fetchImpl: async () => {calls++; return Response.json({model: MODEL, choices: [{finish_reason: 'stop', message: {content: 'Loopback mock.'}}]});}});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const call = ({headers = {}, method = 'GET', path = '/status', body} = {}) => new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, method, path, headers: {host: '127.0.0.1:8787', authorization: `Bearer ${token}`, ...headers}}, res => {
      let text = ''; res.on('data', chunk => text += chunk); res.on('end', () => resolve({status: res.statusCode, text}));
    });
    req.on('error', reject); req.end(body);
  });
  assert.equal((await call()).status, 200);
  assert.equal((await call({headers: {host: 'evil.invalid'}})).status, 403);
  assert.equal((await call({headers: {authorization: 'Bearer wrong'}})).status, 401);
  assert.equal(calls, 0);
  const r = await call({method: 'POST', path: '/rewrite', headers: {'content-type': 'application/json'}, body: JSON.stringify(args)});
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.text).text, 'Loopback mock.');
  assert.equal(calls, 1);
});
test('Node refuses public plaintext origin and malformed configuration', () => {
  assert.throws(() => createService({...env, SERVICE_ORIGIN: 'http://public.example'}));
  assert.throws(() => createService({...env, SERVICE_ORIGIN: 'https://public.example/subpath'}));
  assert.throws(() => createService({...env, SERVICE_ACCESS_TOKEN: ''}));
});
