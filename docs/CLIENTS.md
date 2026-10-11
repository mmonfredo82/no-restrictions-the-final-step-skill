# Client compatibility

## Portable skill and local runner

`skill/SKILL.md` is an instruction package, not an installed cloud connector. An assistant with permitted shell execution can invoke the local runner after the owner has securely configured a key and authorized the selected text. An assistant without code execution can help prepare a request, but must not claim to have called Qwen or silently use a different model.

The offline Python builder under `skill/scripts/` works without dependencies and requires no credential. Installing the skill alone does not authorize network access, payment, background work, or unrelated private-data sharing.

## Cloudflare MCP and custom headers

Consult [the Cloudflare README](../cloudflare/README.md) for the implemented endpoint, pinned library versions, and tests. Where the client permits a secure custom request header, set `Authorization: Bearer YOUR_SERVICE_ACCESS_TOKEN` in that client's secure configuration UI. Use your service token, never your OpenRouter key. Do not place it in the endpoint URL or in a chat message.

[Claude's custom-header authentication](https://claude.com/docs/connectors/custom/add-unlisted#authenticate-with-request-headers) is a beta/organization-dependent feature. Do not assume it appears for every account. Other MCP clients vary. A generic HTTP client can use the supplied REST route regardless of MCP connector availability.

## ChatGPT and OAuth

[OpenAI's authenticated MCP guidance](https://developers.openai.com/plugins/build/auth) uses OAuth. This release does **not** implement an OAuth authorization server, client registration, a consent UI, token issuance, or account login. Supplying the service URL alone does not produce a functioning authenticated ChatGPT connector. No live ChatGPT or Claude end-to-end connection has been verified for this public package.

A future OAuth adapter should use a maintained implementation such as [Cloudflare Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider), following [Cloudflare's authorization guidance](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/) and [consent security requirements](https://developers.cloudflare.com/agents/model-context-protocol/guides/securing-mcp-server/). That adapter requires actual account setup, not just a secret pasted into this bearer server:

1. A GitHub OAuth App or another supported identity-provider registration, with the exact public callback URL; secrets stored server-side.
2. Provider state/token storage such as `OAUTH_KV` and an explicit numeric owner-ID allowlist before tokens are issued. A login by any GitHub account must not grant spending access to the owner's OpenRouter account.
3. Correct authorization-server and protected-resource discovery, 401 discovery challenges, PKCE S256, supported client registration, redirect validation, resource/audience binding, CSRF protection and informed consent.
4. Verified client interoperability and negative authentication tests before real selected text is sent.

This is an integration checklist, **not implemented functionality or a claim that OAuth is ready**. Do not hand-roll a password-to-token shortcut or trust a caller-supplied `oai-authenticated-user-id` header. [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices) rejects token passthrough; the OpenRouter key stays at the server and is only used to authenticate requests to OpenRouter.
