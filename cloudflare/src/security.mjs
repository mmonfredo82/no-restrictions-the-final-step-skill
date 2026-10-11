// This module never logs requests, environment bindings, tokens, or exceptions.
const encoder = new TextEncoder();

export function jsonResponse(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
      ...extraHeaders,
    },
  });
}

export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Vary', 'Origin');
  // This server is for trusted native/server clients, with no browser CORS API.
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith('access-control-')) headers.delete(name);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unavailable() {
  return jsonResponse({ status: 'error', error: 'service_unavailable' }, 503);
}

export function configuredOrigin(env) {
  if (typeof env.SERVICE_ORIGIN !== 'string') return null;
  try {
    const url = new URL(env.SERVICE_ORIGIN);
    if (url.origin !== env.SERVICE_ORIGIN || url.username || url.password) return null;
    const local = url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === 'localhost');
    return url.protocol === 'https:' || local ? url.origin : null;
  } catch {
    return null;
  }
}

function configuredToken(env) {
  const token = env.SERVICE_ACCESS_TOKEN;
  // The operator must create at least 32 random bytes and encode them as hex.
  // Length/format are checked here; randomness must come from a CSPRNG.
  if (typeof token !== 'string' || !/^[a-fA-F0-9]{64,}$/.test(token)) return null;
  if (token === env.OPENROUTER_API_KEY?.trim()) return null;
  return token;
}

async function tokensMatch(provided, expected) {
  // Hash both values to fixed-size buffers, then compare every byte.
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}

export async function authorizeRequest(request, env) {
  const origin = configuredOrigin(env);
  const token = configuredToken(env);
  if (!origin || !token) return unavailable();

  // Require the explicitly configured origin, not an attacker-supplied Host.
  if (new URL(request.url).origin !== origin) {
    return jsonResponse({ status: 'error', error: 'forbidden' }, 403);
  }
  const browserOrigin = request.headers.get('Origin');
  if (browserOrigin !== null && browserOrigin !== origin) {
    return jsonResponse({ status: 'error', error: 'forbidden' }, 403);
  }

  // No user-ID headers, cookies, query parameters, or OpenRouter tokens are trusted.
  const authorization = request.headers.get('Authorization');
  const match = authorization?.match(/^Bearer ([a-fA-F0-9]+)$/i);
  if (!match || !(await tokensMatch(match[1], token))) {
    return jsonResponse({ status: 'error', error: 'unauthorized' }, 401, {
      'WWW-Authenticate': 'Bearer realm="no-restrictions-final-step"',
    });
  }
  return null;
}
