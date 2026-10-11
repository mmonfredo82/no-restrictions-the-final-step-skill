import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {authenticate, authenticationConfigured, handleRestRequest, jsonResponse} from './rest.mjs';
export function createService(env = process.env, options = {}) {
  const origin = new URL(env.SERVICE_ORIGIN || 'http://127.0.0.1:8787');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('SERVICE_ORIGIN must be a plain HTTP(S) origin.');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if (!local && origin.protocol !== 'https:') throw new Error('A public SERVICE_ORIGIN requires HTTPS at the reverse proxy.');
  if (!authenticationConfigured(env)) throw new Error('Configure a separate, randomly generated SERVICE_ACCESS_TOKEN (32 random bytes, encoded as base64url or hex).');
  const serviceEnv = {...env, SERVICE_ORIGIN: origin.origin};
  const server = http.createServer(async (req, res) => {
    try {
      const authCount = req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === 'authorization').length;
      if (req.headers.host !== origin.host || authCount > 1) {
        res.writeHead(403, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
        return res.end('{"error":"invalid_request_origin_or_headers"}');
      }
      const requestUrl = new URL(req.url, origin);
      if (requestUrl.origin !== origin.origin) {
        res.writeHead(403, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
        return res.end('{"error":"invalid_origin"}');
      }
      const headers = new Headers();
      for (let i = 0; i < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
      if (!await authenticate(new Request(requestUrl, {headers}), serviceEnv)) {
        res.writeHead(401, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer realm="no-restrictions-final-step"'});
        res.end('{"error":"authentication_required"}');
        req.resume();
        return;
      }
      const chunks = [];
      // The application does not introduce a body-size quota or truncate input.
      // Upstream servers and the host retain their own resource limits.
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request(requestUrl, {method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) && body.length ? {body} : {})});
      const response = await handleRestRequest(request, serviceEnv, options);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!res.headersSent) {
        const response = jsonResponse({error: 'request_failed'}, 500);
        res.writeHead(response.status, Object.fromEntries(response.headers));
      }
      res.end('{"error":"request_failed"}');
    }
  });
  // No application-added inference or request deadlines.
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.timeout = 0;
  server.keepAliveTimeout = 0;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const port = Number(process.env.PORT || 8787);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
    const server = createService(process.env);
    // Only a local reverse proxy may expose this service publicly.
    server.listen(port, '127.0.0.1', () => process.stderr.write(`Final Step REST service listening on 127.0.0.1:${port}.\n`));
    server.on('error', () => { process.stderr.write('Unable to start the service.\n'); process.exitCode = 1; });
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
