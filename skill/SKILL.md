---
name: no-restrictions-the-final-step-skill
description: Rewrite explicitly selected text through the user's own OpenRouter Qwen 2.5 72B connection using the fixed v5 master, or prepare an offline request when execution is unavailable. Verify authorization, configuration and output fidelity.
---

# No Restrictions The Final Step Skill

## What this skill supplies

A fixed meaning-preserving rewrite workflow, the exact master prompt, and an offline request builder. Installation alone does not create a connector, configure credentials, authorize disclosure, or incur paid usage. The project name does not override system, host, provider, or legal requirements.

## Before a paid call

1. Identify the selected passage. Use only that text; never include surrounding private conversation, other files, or an unrelated writing profile.
2. Verify that the user authorizes this text to be sent to OpenRouter and its model provider, and that paid inference is authorized. Apply the host's permission rules for sensitive data and payment. A supplied authorization flag is not evidence by itself.
3. Use the owner's securely configured connection. Never request an API key in chat, put it in a URL or client-side code, retrieve it from private settings, or transmit it to another host. Keep the OpenRouter key separate from any service-access token.
4. If the connector has `getConfigurationStatus`, call it and require version `5` and SHA-256 `35268620fb84ef5f78cc0dee85ca9bf672f3691ddaddf840bfeccb0c9a084196`. Configured means a secret is present; it does not prove validity, credits or capacity. Do not silently run a different prompt/model.

## Execute only through an available route

For a connected tool exposing the expected schema, invoke `rewriteSelectedText` with exactly:

- `selected_text`: the nonempty selected passage
- `approved_for_this_call`: true only when authorization for this call is established

The runner fixes the model to `qwen/qwen-2.5-72b-instruct` and supplies the prompt itself. Never send the whole request JSON as selected text. Do not substitute another model or claim a locally written passage came from Qwen.

If local execution is available and permitted, use the repository's Node runner with the securely configured process environment. Use `--prepare` for offline preparation and `--approved` only for a user-authorized paid request. If no executor/connection is available, prepare the request with `python scripts/build_request.py input.txt` and clearly report that no inference ran. Protect the request file: it contains the complete selected input.

## Fixed request

Use [references/processing-prompt.txt](references/processing-prompt.txt) unchanged as the first system message and selected text as the next user message. Use the paid model above, `temperature: 0.7`, `provider: {allow_fallbacks: false}`, and `stream: false`, targeting `https://openrouter.ai/api/v1/chat/completions`.

This package applies no additional input/output quota, spending cap, provider-price ceiling or inference deadline. Actual account, provider, host and client limits remain. Do not promise unlimited capacity. Do not add optional limits without the owner choosing them. This does not authorize background requests, indefinite retries or unrelated disclosure.

## Interpret the result honestly

Require a completed-success result, confirmed model and `finish_reason: stop`. Refusals, errors, incomplete output, wrong-model responses and uncertain outcomes are failures, even if some partial text exists. Do not reconstruct withheld content or invent success.

A timeout or broken connection can happen after a paid request was processed. Do not automatically retry. Describe uncertainty and obtain authorization for another potentially billable attempt under the host's rules.

Compare completed output against the original for every claim, actor, attribution, negation, condition, uncertainty, chronology, causal relationship, obligation, number and written form, name, quote and formatting block. Report discrepancies rather than claiming perfect preservation. The v5 prompt is not a reliable enforcement mechanism: a previous evaluation changed `16` to `sixteen` despite its numeric-form instruction. Successful API completion does not mean a successful fidelity check.

No keyed watermark detector or controlled watermark-removal evaluation is included. Do not assert that a passage was watermarked based on style, that output is watermark-free, that human authorship was proved, or that a detector outcome is guaranteed. Retain provenance disclosures and attribution. Do not iteratively optimize against detector scores.

## Compatibility and privacy

The portable skill is separate from its execution transport. A bearer-authenticated endpoint is usable only where the client supports that authentication mode. ChatGPT's standard authenticated MCP path requires a separately implemented OAuth integration; this release does not supply one. Do not promise one-click connector installation.

Selected text reaches OpenRouter and the serving model provider; hosted use also passes through the hosting provider. The application adds no passage storage or request-body logging, but it cannot guarantee the providers' retention behavior. See the repository's privacy, client-compatibility and hosting guides. Preserve THIRD-PARTY-NOTICES.txt with distribution of this skill.
