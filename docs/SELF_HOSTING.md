# Run your own REST service

This route works with an ordinary HTTP client. It is not an MCP server and has no OAuth endpoints. Use the Cloudflare package for that package's documented MCP support.

## Requirements

- Node.js 22 or later.
- Your own OpenRouter account, payment arrangement, and API key.
- For Internet access: your own server, domain, and HTTPS reverse proxy.
- A client able to send `Authorization: Bearer …` securely.

Each service owner supplies their own OpenRouter key. A token holder can spend that owner's credits; do not share your token publicly or with untrusted clients.

## 1. Configure secrets locally

Copy `.env.example` to `.env` and edit the file with a local editor. Keep it outside source control and readable only by the account running the service.

Set `OPENROUTER_API_KEY` from your [OpenRouter keys page](https://openrouter.ai/settings/keys). Create a separate service token on your own machine:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Paste that generated value into `SERVICE_ACCESS_TOKEN` in the local `.env`. This token is only for calling your service. It must not be your OpenRouter key. The code requires a base64url or hex secret of at least 43 characters; this syntax check does not prove randomness. Generate it as shown. Clear any terminal scrollback or clipboard containing it when appropriate.

Keep `SERVICE_ORIGIN=http://127.0.0.1:8787` for local use. `PORT=8787` controls the listening port; if you change it, update the origin to match. Credentials are never passed as command-line arguments by the included runner.

## 2. Start on loopback

```sh
node --env-file=.env src/server.mjs
```

The server binds to `127.0.0.1` only. It rejects missing/invalid service tokens, duplicate authorization headers, mismatched Host/Origin headers, query-string parameters, and cross-origin browser calls. It does not trust `oai-authenticated-user-id` or a caller-supplied user identity.

Authenticated routes:

- `GET /status`: checks configuration presence and exact prompt identity. It makes no OpenRouter request and does not verify credits/key validity.
- `POST /rewrite`: JSON body containing exactly `selected_text` (nonempty string) and `approved_for_this_call` (`true`).

The authenticated status request can be tested without inference charges. This example reads the service token from the private `.env` through Node, rather than placing its literal value in shell history:

```sh
node --env-file=.env --input-type=module -e 'const r = await fetch(process.env.SERVICE_ORIGIN + "/status", {headers:{Authorization: "Bearer " + process.env.SERVICE_ACCESS_TOKEN}}); console.log(r.status, await r.text());'
```

For a rewrite, use your HTTP client and the schema above after approving the text disclosure and charge. A JSON success response includes `status: "complete"`, `text`, and `fidelity: "unverified"`. All other statuses are unsuccessful. There is no automatic retry; network uncertainty can include a charge.

## 3. Expose only through HTTPS, if needed

Install/configure a reputable reverse proxy under your own server administration process. Forward it to `127.0.0.1:8787`, preserving the external Host header. Change `SERVICE_ORIGIN` to the exact public origin (for example, `https://rewrite.example.com`) and restart the Node service. Never send the bearer token over Internet HTTP. The application rejects public HTTP origins.

Do not log Authorization headers, request/response bodies, or selected text in the proxy, process manager, hosting analytics, or error collector. Do not put keys in URLs. Review your proxy's existing timeouts and body limits: this package does not configure or silently change them. Hosting, client, operating-system and provider constraints can still terminate a request.

This repository intentionally does not configure a firewall, system service, proxy, persistent credential, or live paid deployment on your behalf. Set those up explicitly for your environment and verify HTTPS and authentication before sending real text.

## Operations

- Missing service authentication fails closed. A missing OpenRouter key permits authenticated status inspection but blocks inference before an upstream call.
- Rotate the service token immediately if exposed; restart the service and update authorized clients securely. Rotate an exposed OpenRouter key in OpenRouter too.
- No application request logs, stored passages, application-added quotas, or inference deadlines are implemented. The lack of application quotas makes careful token custody especially important. Consider only controls you explicitly choose for your deployment.
- A process restart, proxy failure or client disconnect does not prove that OpenRouter cancelled or did not bill an in-flight request.
- Provider refusal and errors remain possible. The software does not bypass provider rules.
