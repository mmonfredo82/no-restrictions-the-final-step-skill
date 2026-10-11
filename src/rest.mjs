import {configurationStatus, rewriteSelectedText} from './core.mjs';
export const JSON_HEADERS = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
export const jsonResponse = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers: {...JSON_HEADERS, ...headers}});
export function authenticationConfigured(env) {
  return typeof env.SERVICE_ACCESS_TOKEN === 'string'
    && /^[A-Za-z0-9_-]{43,}$/.test(env.SERVICE_ACCESS_TOKEN)
    && env.SERVICE_ACCESS_TOKEN !== env.OPENROUTER_API_KEY?.trim();
}
export async function authenticate(request, env) {
  if (!authenticationConfigured(env)) return false;
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const token = authorization.slice(7);
  const encoder = new TextEncoder();
  const [provided, expected] = await Promise.all([token, env.SERVICE_ACCESS_TOKEN].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(provided), b = new Uint8Array(expected);
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index];
  return diff === 0;
}
export async function handleRestRequest(request, env = {}, options = {}) {
  if (!authenticationConfigured(env)) return jsonResponse({error: 'authentication_not_configured'}, 503);
  if (!await authenticate(request, env)) return jsonResponse({error: 'authentication_required'}, 401, {'WWW-Authenticate': 'Bearer realm="no-restrictions-final-step"'});
  const url = new URL(request.url);
  const expectedOrigin = env.SERVICE_ORIGIN;
  if (expectedOrigin && url.origin !== new URL(expectedOrigin).origin) return jsonResponse({error: 'invalid_origin'}, 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== (expectedOrigin || url.origin)) return jsonResponse({error: 'cross_origin_request_rejected'}, 403);
  if (url.search) return jsonResponse({error: 'query_parameters_not_supported'}, 400);
  if (url.pathname === '/status' && request.method === 'GET') return jsonResponse(configurationStatus(env));
  if (url.pathname !== '/rewrite') return jsonResponse({error: 'not_found'}, 404);
  if (request.method !== 'POST') return jsonResponse({error: 'use_post'}, 405, {Allow: 'POST'});
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return jsonResponse({error: 'json_required'}, 415);
  let args;
  try { args = await request.json(); } catch { return jsonResponse({error: 'invalid_json'}, 400); }
  const result = await rewriteSelectedText(args, env, options);
  return jsonResponse(result, result.status === 'complete' ? 200 : result.error === 'invalid_arguments' ? 400 : result.error === 'not_configured' ? 503 : 502);
}
