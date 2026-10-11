# Security

## Threat model

This is a single-owner rewriting service. Possession of its service token permits paid calls against the owner's configured OpenRouter key. It is not a public multi-tenant platform, an account-management system, or a safe way to share the owner's credit balance with strangers.

- Keep OpenRouter and service-access credentials separate and server-side.
- Authenticate before inference. Missing authentication configuration fails closed.
- The Node service binds to loopback. Only expose it through a correctly configured HTTPS reverse proxy.
- Do not trust `oai-authenticated-user-id` outside a separately verified platform boundary. This package does not use it.
- Redirects from OpenRouter are not followed, so credentials are not forwarded to another destination.
- Provider error bodies are not returned to clients because they can contain selected text or private metadata.
- Refused, partial, malformed, wrong-model and unconfirmed outputs are withheld. This does not validate the semantics of successful output.
- There are no automatic paid retries and no fallback models.
- Prompt injection inside selected text is treated as content by the fixed system prompt. Model behavior is not guaranteed; the model has no tools, filesystem access or additional conversation context in this request.
- No application-added spending cap, input/output quota or inference timeout is configured. Provider/hosting limits still apply. Protect the token and understand the cost exposure before exposing the service.

Never commit `.env`, `.dev.vars`, credentials, private test transcripts, user data, or deployment logs. Run `npm run check`, inspect files manually, and review your staging diff before publication. The included secret scan is heuristic, not proof that a repository is secret-free.

For a vulnerability, use the repository's private vulnerability-reporting feature if it has been enabled. If it is unavailable, do not post credentials or exploitable private details in a public issue; contact the repository owner through a private channel you can verify. Revoke exposed credentials first.
