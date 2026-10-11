# Cloudflare deployment

This is a self-hosted, authenticated Worker for **No Restrictions The Final Step Skill**. It offers the actual MCP library transport at `/mcp` and a small REST API. You bring your own Cloudflare account, OpenRouter account, model access/credits, and private credentials. The repository owner does not provide a hosted endpoint, pay for your requests, or receive your keys.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mmonfredo82/no-restrictions-the-final-step-skill/tree/main/cloudflare)

The button starts Cloudflare's setup flow. It is not a no-setup connection to ChatGPT or Claude. Complete the account, secrets, origin, and client setup below. A live deployment or account-specific connector installation has not been verified by the package's automated tests.

## What is supported

- `/mcp`: stateless HTTP MCP using Cloudflare's `createMcpHandler` and MCP SDK v2. The pinned library also supports ordinary legacy MCP initialize/tool calls. There are exactly two tools: `getConfigurationStatus` and `rewriteSelectedText`.
- `GET /v1/configuration`: authenticated, local configuration status; no provider request.
- `POST /v1/rewrite`: authenticated rewrite with the same core and approval flag.
- Every route requires `Authorization: Bearer <SERVICE_ACCESS_TOKEN>`. Caller-supplied identity headers, cookies, query tokens, and OpenRouter keys are not authentication.

The service token must be stored in the Worker's secrets and your trusted client's private credential store. **Never put either secret in a skill file, chat prompt, public repository, browser JavaScript, URL, screenshot, or logs.** The OpenRouter key stays server-side and is sent only to OpenRouter. The service token is never forwarded to OpenRouter.

This is a private, single-operator bearer-authentication deployment. It does not implement OAuth discovery, authorization, refresh tokens, user accounts, or per-user billing. It is unsuitable as a public multi-user paid endpoint without a separate reviewed identity/billing design.

## Accounts and prerequisites

1. Have your own [Cloudflare account](https://dash.cloudflare.com/) and permission to deploy Workers. Hosting charges and Cloudflare's platform limits may apply.
2. Have your own [OpenRouter account and API key](https://openrouter.ai/settings/keys), sufficient credits, and access to `qwen/qwen-2.5-72b-instruct`. Availability and prices are controlled by the provider.
3. For CLI setup, install Node.js 24+ and npm, and use the published lockfile. The scripts below run from this `cloudflare` directory, or from the isolated repository created by the button.
4. Review the source, [security notes](#security-and-costs), and external processing before sending private text. OpenRouter routes the selected text to a model provider; relevant provider terms and data handling apply.

No key, account, OAuth grant, or live deployment is included in this package.

## Deploy with the button

1. Open the button and sign into your own Cloudflare and GitHub/GitLab accounts. Review the repository-copy and deployment permissions yourself.
2. Choose your repository/Worker name. This subdirectory is self-contained because Cloudflare copies the chosen subdirectory as the new repository root.
3. Supply both required secrets:
   - `OPENROUTER_API_KEY`: your own OpenRouter key.
   - `SERVICE_ACCESS_TOKEN`: a **different** value created from at least 32 cryptographically random bytes, encoded as hex. Generate it locally with `openssl rand -hex 32` or an equivalent secure generator. Keep a private copy for client setup. The server validates hex format and minimum length, but cannot prove randomness.
4. Keep secrets marked as secrets, not ordinary build variables or committed configuration. If the setup screen omits a secret, add it under your Worker's Settings → Variables and Secrets before proceeding.
5. `SERVICE_ORIGIN` must be the exact origin of your Worker, such as `https://your-worker.your-subdomain.workers.dev`, with no trailing slash or path. The repository contains a placeholder. After Cloudflare supplies your actual URL, replace that placeholder in `wrangler.jsonc` in your copied repository and redeploy. Until it matches, the Worker refuses requests.
6. Use `npm ci` for installation, `npm run build` for the build command, and `npm run deploy` for deployment. Confirm the required secrets are present in the deployed Worker, not just in a build environment.
7. Perform the configuration check below. Then configure a trusted MCP or REST client that supports a private bearer token.

If button setup or your client's authentication options differ, use the explicit CLI path below. There is no need to weaken or remove authentication.

## Deploy with the CLI

Clone/download the public repository, then run:

```sh
cd cloudflare
npm ci
npm run check
```

The tests use inert fixtures and mocked provider responses; they do not call OpenRouter or incur model charges. `check` verifies generated source integrity, runs handler tests, builds with Wrangler, and runs the bundle in local `workerd`.

Create a private local secrets file:

```sh
cp .dev.vars.example .dev.vars
chmod 600 .dev.vars
openssl rand -hex 32
```

Edit `.dev.vars` locally. Set `OPENROUTER_API_KEY` and set `SERVICE_ACCESS_TOKEN` to the newly generated hex token. The example deliberately contains no usable secrets. Do not send these values to an assistant or commit the file. `.gitignore` excludes it, but check your staged files before committing.

Choose your Worker name in `wrangler.jsonc`. Log into Cloudflare yourself and deploy the code and both secrets together:

```sh
npx wrangler login
npm run deploy -- --secrets-file .dev.vars
```

Review and accept Cloudflare's authorization screen yourself. The first deployment uses the placeholder origin and therefore refuses use. Copy the actual HTTPS origin from the deployment result into `vars.SERVICE_ORIGIN` in `wrangler.jsonc`, then deploy that correction:

```sh
npm run deploy
```

The already configured Worker secrets are retained. A later origin/domain change requires updating `SERVICE_ORIGIN` and your client endpoint. Preview URLs are disabled. When using a custom domain, select that exact HTTPS origin; requests to other hostnames are refused.

For secret rotation, use `npx wrangler secret put SERVICE_ACCESS_TOKEN` or `npx wrangler secret put OPENROUTER_API_KEY`, entering the value in the CLI prompt yourself. These commands deploy a new Worker version. Rotating the service token also requires updating each authorized client's secret store.

Cloudflare documents [Worker secrets and simultaneous code/secret deployment](https://developers.cloudflare.com/workers/configuration/secrets/). Deployment creates a network-accessible service in your account and can create charges; only run the deployment commands when you intend that outcome.

## Verify without a paid model call

Save this as a local script if useful. It obtains the service token from your shell environment instead of embedding a credential in source. Use your own private mechanism to populate that environment variable; do not print or paste its value into chat.

```js
const response = await fetch(`${process.env.SERVICE_ORIGIN}/v1/configuration`, {
  headers: { Authorization: `Bearer ${process.env.SERVICE_ACCESS_TOKEN}` },
});
console.log(response.status, await response.json());
```

Expect HTTP 200 and `connection: "configured_unverified"` when the OpenRouter key is present. This confirms secret presence only. It does **not** prove that the key is valid, the model is available, credits remain, or rewriting is faithful. An unauthenticated request must return HTTP 401. A mismatched origin returns HTTP 403. Missing/invalid service configuration returns HTTP 503.

A separate, explicitly approved rewrite is required for a real provider smoke test. It may be billed. Do not automatically retry an uncertain outcome.

## Connect a client

For a compatible trusted MCP client, configure:

- Transport: HTTP/Streamable HTTP
- URL: your exact HTTPS origin plus `/mcp`
- Authentication: bearer token from the client's private secret store
- Token: `SERVICE_ACCESS_TOKEN`, **not** `OPENROUTER_API_KEY`

Client setup fields and supported authentication vary. This repository does not claim every ChatGPT, Claude, or other client can store a custom bearer header. If your client requires OAuth, this Worker cannot complete that flow as shipped. Do not paste a key into chat or choose “no authentication” to work around it. Use a supported private-client route, or implement a separately reviewed OAuth deployment based on [Cloudflare's official authorization examples](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/) and [Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider). Do not use a mock login as production authentication.

The included MCP library handles the protocol; this project does not hand-roll JSON-RPC or OAuth. Legacy ordinary tool calls are tested, but persistent sessions, sampling, roots, pushed elicitation, resumable streams, or client-specific user interfaces are not part of this package's compatibility promise. See [Cloudflare's handler API and transport guidance](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/).

REST clients use the same private authentication header. Send `Content-Type: application/json` to `/v1/rewrite` with exactly:

```json
{
  "selected_text": "Only the text explicitly selected for this request.",
  "approved_for_this_call": true
}
```

Set the approval flag only after the user authorizes that exact external processing call. The flag is a caller assertion; a server cannot independently verify an assistant's conversation. Do not send surrounding conversations, files, credentials, or unrelated text. The response is complete only when `status` is `complete`. Application outcomes use HTTP 200; always inspect the JSON status. Transport/authentication failures use 4xx/5xx.

## Local development

After creating your private `.dev.vars`, run `npm run dev`. It binds to `127.0.0.1:8787` and explicitly selects that local origin. No tunnel or public listener is configured. Authentication remains mandatory, including for local configuration reads. Keep development secrets private. A local rewrite still reaches the live provider and can incur a charge unless you run the mocked tests instead.

## Security and costs

- Exact deployment origin and every present browser `Origin` are validated. Cross-origin browser access is not offered, and no wildcard CORS headers are emitted. CORS is not the authentication layer.
- Tokens are compared through fixed-size hashes. Invalid/missing service secrets fail closed. A service token equal to the trimmed OpenRouter key is refused.
- Application code does not log request text, headers, environment bindings, provider responses, or exception details. Worker observability is disabled in this template. Your hosting/client/provider infrastructure has its own data handling and logs; configure and review it separately.
- Error responses are sanitized. Partial/refused/unconfirmed model output is withheld. The service does not automatically retry, switch models, or reconstruct missing output.
- The model, original v5 processing prompt, temperature, and no-provider-fallback setting come from the shared core. The result's `fidelity: "unverified"` requires an independent review of the complete result against the selected input.
- There are no application input/output-token caps, request timeouts, usage quotas, or spending caps configured by this package. Cloudflare, OpenRouter, model providers, SDKs, and clients still impose their own constraints/defaults. Anyone who obtains your service token can make billable requests against your key; protect and rotate it accordingly.
- A timeout or broken connection may leave billing/completion uncertain. Check available provider records before authorizing another paid attempt. Client cancellation cannot guarantee cancellation of provider processing.

## Integrity and maintenance

This isolated template includes generated copies of the repository's `src/core.mjs` and `src/generated-prompt.mjs` under `shared/`. `shared/manifest.json` records their SHA-256 hashes. `npm run check-shared` verifies those hashes and, when the full repository is present, verifies byte equality against the canonical sources. In the full source repository, run `npm run sync-shared` here after an authorized core change, then rerun all checks. Do not hand-edit the copies.

Direct dependencies are pinned in `package.json`; the complete dependency graph and integrity hashes are locked in `package-lock.json`. Use `npm ci` and review dependency changes before upgrading. Current pins: Agents `0.28.0`, MCP server `2.0.0`, Zod `4.6.6`, Wrangler `4.149.0`, and test-only Miniflare `5.20261006.1-alpha` (the version used by this Wrangler release). The MCP server is deliberately pinned to the version expected by Agents, rather than a newer incompatible peer.

See the included `LICENSE`, `THIRD-PARTY-NOTICES.txt`, and `licenses/`. The upstream adapter/skill license notices are retained. The source publishes a deployment option; it does not certify compatibility with every client, guarantee provider availability, or guarantee output fidelity.

Official deployment-button behavior: [Cloudflare Deploy buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/).
