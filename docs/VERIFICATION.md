# Verification and known limitations

Verification date: 2026-10-11. Test environment: Linux, Node.js 24.19.0, npm 11.9.0 and Python 3. Commands below use only mock provider responses except for package installation from the public npm registry. No live OpenRouter inference, deployment, account login, credential creation, or real ChatGPT/Claude connection was performed for this release.

## Master integrity

- Exact v5 master: 37,232 bytes.
- SHA-256: `35268620fb84ef5f78cc0dee85ca9bf672f3691ddaddf840bfeccb0c9a084196`.
- The skill copy and runtime generated string match the master.
- Cloudflare's isolated copies have their own SHA-256 manifest and are checked against canonical source when the full repository is present.

The master was preserved unchanged. Existing private deployment code and installed personal skill were not modified by creation of this separate public package.

## Local checks

From the repository root:

```sh
npm ci --ignore-scripts --offline
npm run build
npm run check
```

The root package has no npm runtime or development dependencies. The suite contains 21 passing tests covering:

- Exact prompt and selected-text bytes, including CRLF and meaningful Unicode.
- Actual offline CLI input via standard input and file, plus Python/JavaScript request equivalence.
- Strict selected-text/approval argument boundaries; no extra history or model override.
- Fixed paid model, no application-added caps/deadlines, no redirects, retries or model fallback.
- Missing keys, authentication failure, billing/provider errors, malformed responses, refused/partial/wrong-model output, and potentially billed uncertainty.
- No truncation of large mocked input or output; no false fidelity guarantee.
- Actual loopback Node HTTP server request, Host/authentication enforcement, REST success/error handling and no wildcard CORS.
- No credential or arbitrary provider-error text in returned diagnostics.

Node.js 22 is the declared minimum for the local runner, based on the built-in APIs used; the full suite was executed on Node 24.19.0 rather than every supported Node release. Python 3 is needed for the offline-builder equivalence test. The normal Node runner itself does not use Python.

## Cloudflare checks

The Cloudflare package pins Agents 0.28.0, MCP server 2.0.0, Zod 4.6.6, Wrangler 4.149.0 and test-only Miniflare 5.20261006.1-alpha, with a complete npm lockfile.

```sh
cd cloudflare
npm ci
npm run check
```

Clean online installation and a subsequent fully offline `npm ci` both passed (206 installed packages). All 16 handler/security tests passed against the actual installed MCP libraries. Wrangler’s `--dry-run` bundle succeeded, and 1 bundled-runtime test passed in local `workerd` through Miniflare, covering authentication, configuration, MCP initialization/tool listing, a mocked rewrite and rejected Origin. None of these tests is a production deployment or proof of account-specific connector interoperability.

Cloudflare's Deploy button targets the verified public repository's self-contained `cloudflare/` directory. Its account-linking, permission approval, secrets entry and real deployment flow was not completed. A successful local bundle does not prove that every user's Cloudflare plan, permissions or client configuration will work.

## Privacy and license review

The public source excludes private account/skill identifiers, old deployment URLs, credentials, personal conversation history and private test logs. A heuristic secret/private-reference scan passed and the package was reviewed separately. This cannot establish that all possible secrets would be detected. Review every new commit yourself.

Full upstream MIT notices from No AI Slop, Humanize, Humanizer and Avoid AI Writing are retained, including Avoid AI Writing's package notice. Their pinned source links are in THIRD-PARTY-NOTICES.txt. Dependencies retain their own licenses. Source publication does not relicense model weights, service terms or independently licensed source material.

## Model behavior and fidelity

A prior evaluation of this v5 prompt changed `16` to `sixteen` despite the explicit numeric-form preservation instruction. The master is therefore a best-effort instruction, not a reliable numeric-preservation validator. The public package deliberately does not include the private test input/output transcript.

No semantic-equivalence engine is implemented. The code checks protocol-level completion and withholds known incomplete or refused output; it does not prove that successful output preserves claims, causality, review/approval conditions, uncertainty, numeric associations, exact quotes, attribution or layout. Review original and rewritten text yourself before using it.

No source-compatible keyed watermark detector was used and no before/after watermark-removal result is established. Style classifiers, keyed statistical watermarks and meaningful Unicode are different subjects. Do not claim detector-proof text, verified watermark removal or human authorship.

## Remote authentication limitations

The supplied remote implementation uses a deployment-specific bearer token and does not implement OAuth. It only works with clients supporting that transport/authentication combination. Standard ChatGPT authenticated MCP setup needs an additional reviewed OAuth integration. Claude header authentication is account/organization dependent. No production end-to-end ChatGPT or Claude connection has been verified.

## Remaining operational limits

Provider availability, credits, context windows, model output limits, rate limits, host memory/CPU/body handling and client/proxy/SDK deadlines still apply. The package does not add optional quotas, spending caps or inference deadlines. Network failure can leave both completion and billing uncertain. A later retry must be a newly authorized paid attempt, not an automatic fallback.
