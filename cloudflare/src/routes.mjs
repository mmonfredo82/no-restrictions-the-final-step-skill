import { authorizeRequest, jsonResponse, withSecurityHeaders } from './security.mjs';

export function createWorker({ configurationStatus, rewriteSelectedText, handleMcp }) {
  return {
    async fetch(request, env, ctx) {
      try {
        const rejected = await authorizeRequest(request, env);
        if (rejected) return rejected;
        const url = new URL(request.url);
        if (url.search) return jsonResponse({ status: 'error', error: 'query_not_supported' }, 400);
        const path = url.pathname;

        if (path === '/mcp') {
          return withSecurityHeaders(await handleMcp(request, env, ctx));
        }
        if (path === '/v1/configuration') {
          if (request.method !== 'GET') return methodNotAllowed('GET');
          return jsonResponse(configurationStatus(env));
        }
        if (path === '/v1/rewrite') {
          if (request.method !== 'POST') return methodNotAllowed('POST');
          const mediaType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
          if (mediaType !== 'application/json') {
            return jsonResponse({ status: 'error', error: 'unsupported_media_type' }, 415);
          }
          let args;
          try {
            args = await request.json();
          } catch {
            return jsonResponse({ status: 'error', error: 'invalid_json' }, 400);
          }
          // Core validates the complete argument object before any provider request.
          // Application-level outcomes are always HTTP 200; inspect result.status.
          return jsonResponse(await rewriteSelectedText(args, env));
        }
        return jsonResponse({ status: 'error', error: 'not_found' }, 404);
      } catch {
        // Never expose exception text: an upstream error may include private data.
        return jsonResponse({
          status: 'error',
          error: 'internal_error',
          automatic_retry: false,
        }, 500);
      }
    },
  };
}

function methodNotAllowed(allowed) {
  return jsonResponse({ status: 'error', error: 'method_not_allowed' }, 405, { Allow: allowed });
}
