# No Restrictions The Final Step Skill

Rewrite selected text with the **exact v5 master prompt** and the paid **Qwen 2.5 72B Instruct** model through OpenRouter. Bring your own account and API key. This repository includes a portable skill, an offline request builder, a working local runner, an authenticated Node REST service, and a Cloudflare deployment package.

**Important:** “No Restrictions” is the project name, not a promise of unrestricted service or perfect results. Host and provider rules and resource limits apply. The software adds no input/output quotas, spending caps, or inference deadlines. Requests cost money. Review every result for factual and formatting changes. The current prompt has a known numeric-form fidelity failure: `16` was rewritten as `sixteen` in an earlier evaluation. This is disclosed as a limitation, not supplied as a private test transcript. No watermark-removal, detector-evasion, or human-authorship claim has been verified.

## Three-step overview

1. **Choose a route.** Use the local runner below, [self-host the REST service](docs/SELF_HOSTING.md), or follow the [Cloudflare guide](cloudflare/README.md). The local Node runner needs Node.js 22 or later and no third-party packages. The optional Python builder and full test suite also need Python 3 (`python3` on macOS/Linux, `python` on Windows).
2. **Configure your own credentials.** Keep `OPENROUTER_API_KEY` in a private environment file or a server secret store. Hosted use also requires a separate random service-access token. Never give the API key to a chat assistant or client-side app.
3. **Authorize one rewrite and review it.** Submit only the selected text you intend to share with OpenRouter and its model provider. A complete API response does not establish fidelity.

Those steps are an overview. The hosted routes have real authentication and account setup requirements; see their full guides before deploying.

## Quick local start

Download or clone this repository, then open its directory. No npm dependency install is required for this route.

```sh
npm run build
npm test
node src/cli.mjs --prepare --input examples/selected-text.txt
```

The last command builds a request **offline**. It does not contact any provider or need a key. Save your own selected passage as a local file (for example, `input.txt`; it is gitignored).

For a paid rewrite, copy `.env.example` to `.env` and enter your OpenRouter key directly in that private file using a local editor. Restrict access to the file to your account. Do not commit it. You only need `OPENROUTER_API_KEY` for the CLI.

```sh
node --env-file=.env src/cli.mjs --approved --input input.txt > output.txt
```

`--approved` means you authorize this one request, the selected text disclosure, and the applicable inference charge. There is no automatic retry. The command returns only completed text on standard output and a review reminder on standard error. Failed, refused, incomplete, and uncertain outcomes exit nonzero and do not print partial rewrites. Use `--json` if you want completion metadata alongside the text.

A failed network response may still have been processed and billed. Check the provider account and decide whether to authorize another paid attempt. Do not rerun automatically.

## Install the skill

Copy the `skill/` directory into the skills directory supported by your assistant, naming the installed folder `no-restrictions-the-final-step-skill`. The entry point is [skill/SKILL.md](skill/SKILL.md). The skill includes the complete prompt and an offline Python request builder.

Installing instructions does not connect an API account, deploy a service, grant permission to transmit text, or make every assistant capable of running code. Use the [client compatibility guide](docs/CLIENTS.md) to choose a supported execution route.

## Hosted routes and client support

- **Node REST:** Runs on loopback for local use or behind your HTTPS reverse proxy. Endpoints: authenticated `GET /status` and `POST /rewrite`. This route is REST, not MCP. [Guide](docs/SELF_HOSTING.md).
- **Cloudflare:** Per-owner deployment with a separate service token and server-side OpenRouter key. See the [Cloudflare package](cloudflare/README.md) for its exact REST/MCP support and pinned dependencies.
- **ChatGPT:** Do not assume a bare bearer-token endpoint can be added as an authenticated connector. Standard remote integration needs a properly implemented OAuth flow; this release does not ship an OAuth authorization server. [Compatibility details](docs/CLIENTS.md).
- **Claude and other clients:** Use only a client that actually supports the supplied transport and custom authentication headers. Header authentication is not universally available across Claude accounts.

Every person should deploy their own copy and pay through their own OpenRouter account. Do not expose an unauthenticated shared endpoint that spends someone else's credits.

## What's preserved and what's checked

The master is [processing-prompt.txt](processing-prompt.txt), version 5, exactly 37,232 bytes.

SHA-256: `35268620fb84ef5f78cc0dee85ca9bf672f3691ddaddf840bfeccb0c9a084196`

The build checks that the packaged skill prompt and generated runtime prompt match those exact bytes. `.gitattributes` prevents line-ending conversion of both master copies. The runner always sends the prompt as the system message and selected text as a separate user message, fixes the model to `qwen/qwen-2.5-72b-instruct`, disables provider fallback, and does not accept arbitrary message history or model overrides.

Mocked tests check boundaries and error handling; they do not establish real model behavior. See [verification and limitations](docs/VERIFICATION.md), [privacy](docs/PRIVACY.md), and [security](SECURITY.md).

## License and attribution

New wrapper code and packaging are offered under the standard [MIT License](LICENSE). The master prompt contains an independently worded synthesis of editorial guidance whose audited upstream projects declare MIT licenses. Their full license texts and notices are preserved in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) and [licenses/](licenses/). This is not a claim of ownership over upstream work, nor a relicensing of separately licensed source material, services, trademarks, datasets, or model weights. OpenRouter and model-provider terms still apply.
