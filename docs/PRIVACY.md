# Data and privacy

The local runner sends only the selected passage and the fixed processing prompt to `https://openrouter.ai/api/v1/chat/completions`. It never reads conversation history or searches other files. The input file you explicitly select is read in full. Output goes to your terminal or the destination you redirect it to.

For hosted use, your hosting provider also handles the selected text and returned output. With Cloudflare, the path is client → your Cloudflare Worker → OpenRouter → its serving model provider, and back. Client and provider retention settings are outside this application's control. Review [OpenRouter's provider logging guidance](https://openrouter.ai/docs/guides/privacy/provider-logging) and the providers' current terms. This repository does not promise zero retention anywhere along that path.

The application itself does not write passages, provider response bodies, or credentials to a database or request log. It does not add analytics. Infrastructure, process supervisors, local shell redirection, clients, or manually added monitoring can still retain data. Disable body/header logging in infrastructure you control and protect local files. `.gitignore` is an aid, not a substitute for reviewing a commit before publishing.

The OpenRouter key stays in a private process environment or hosting secret store. A separate service-access token is configured for authenticated hosted calls. No identity header supplied by a client is treated as proof of authentication.

Use the skill only for text you are allowed to transmit. Sensitive or third-party confidential content may need additional permission. Installation grants none. The `approved_for_this_call` flag records the caller's assertion of authorization; code cannot independently prove consent.
