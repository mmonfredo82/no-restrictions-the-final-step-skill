import {PROMPT} from './generated-prompt.mjs';
export {PROMPT};
export const MODEL = 'qwen/qwen-2.5-72b-instruct';
export const PROMPT_VERSION = '5';
export const PROMPT_SHA256 = '35268620fb84ef5f78cc0dee85ca9bf672f3691ddaddf840bfeccb0c9a084196';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const error = (code, message, extra = {}) => ({status: 'error', error: code, message, automatic_retry: false, ...extra});
export function validateArgs(args) {
  return !!args && typeof args === 'object' && !Array.isArray(args)
    && Object.keys(args).every(key => ['selected_text', 'approved_for_this_call'].includes(key))
    && typeof args.selected_text === 'string' && !!args.selected_text.trim()
    && args.approved_for_this_call === true;
}
export function buildRequest(selectedText) {
  if (typeof selectedText !== 'string' || !selectedText.trim()) throw new TypeError('Selected text must be nonempty.');
  return {
    model: MODEL,
    messages: [{role: 'system', content: PROMPT}, {role: 'user', content: selectedText}],
    temperature: 0.7,
    provider: {allow_fallbacks: false},
    stream: false,
  };
}
export function configurationStatus(env = {}) {
  const configured = typeof env.OPENROUTER_API_KEY === 'string' && !!env.OPENROUTER_API_KEY.trim();
  return {
    configured,
    connection: configured ? 'configured_unverified' : 'disconnected',
    model: MODEL,
    processing_prompt_version: PROMPT_VERSION,
    processing_prompt_sha256: PROMPT_SHA256,
    application_input_cap: null,
    application_output_token_cap: null,
    application_spending_cap: null,
    application_inference_timeout: null,
    provider_and_hosting_limits_apply: true,
    note: 'Secret presence does not verify authentication, credits, model availability or output fidelity.',
  };
}
function uncertain(cause, phase, started, httpStatus = null) {
  const errorClass = ['TimeoutError', 'AbortError'].includes(cause?.name)
    ? 'upstream_or_platform_timeout'
    : cause?.name === 'SyntaxError' ? 'invalid_provider_json' : 'network_or_response_error';
  return {
    status: 'uncertain', error: 'completion_not_received', error_class: errorClass,
    phase, http_status: httpStatus, elapsed_ms: Math.max(0, Date.now() - started),
    outcome_uncertain: true, automatic_retry: false,
    message: 'A complete result was not received. The provider may have processed and charged for this request. Authorize any new paid attempt with that uncertainty in mind.',
  };
}
function providerError(status) {
  const category = ({401: 'authentication', 402: 'payment_required', 403: 'permission_denied', 404: 'unavailable', 408: 'timeout', 413: 'provider_input_limit', 429: 'rate_limited', 500: 'provider_error', 502: 'provider_unavailable', 503: 'provider_unavailable', 504: 'timeout'})[status] || 'provider_error';
  return error('provider_error', 'OpenRouter did not return a complete rewrite. No automatic retry or model fallback was used.', {http_status: status, error_class: category, outcome_uncertain: status >= 500 || status === 408});
}
export async function rewriteSelectedText(args, env = {}, {fetchImpl = globalThis.fetch} = {}) {
  if (!validateArgs(args)) return error('invalid_arguments', 'Provide only nonempty selected_text and approved_for_this_call=true.');
  if (!configurationStatus(env).configured) return error('not_configured', 'Set OPENROUTER_API_KEY securely on the machine that runs this service.');
  const started = Date.now();
  let response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {'Authorization': `Bearer ${env.OPENROUTER_API_KEY.trim()}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(buildRequest(args.selected_text)),
      redirect: 'manual',
    });
  } catch (cause) { return uncertain(cause, 'request', started); }
  if (!response.ok) return providerError(response.status);
  let data;
  try { data = await response.json(); }
  catch (cause) { return uncertain(cause, 'response_body', started, response.status); }
  if (data?.error) return error('provider_error', 'The provider returned an error. Its raw message was withheld to avoid exposing request text or secrets.', {http_status: response.status, outcome_uncertain: true});
  const choice = data?.choices?.[0];
  if (choice?.error) return error('provider_error', 'The provider marked this choice as failed. Output withheld.', {outcome_uncertain: true});
  const finishReason = ['stop', 'length', 'content_filter', 'error', 'tool_calls', 'function_call'].includes(choice?.finish_reason) ? choice.finish_reason : 'unknown';
  if (choice?.message?.refusal || finishReason === 'content_filter') return {status: 'refused', error: 'provider_refusal', finish_reason: finishReason, automatic_retry: false, message: 'The provider declined the rewrite. Refused or partial text was withheld.'};
  if (finishReason !== 'stop') return {status: finishReason === 'error' ? 'error' : 'incomplete', error: finishReason === 'length' ? 'provider_output_limit' : 'completion_not_confirmed', finish_reason: finishReason, automatic_retry: false, message: 'The provider did not confirm a complete rewrite. Partial output was withheld.'};
  if (![MODEL, 'qwen/qwen2.5-72b-instruct'].includes(data?.model)) return error('unexpected_model', 'The response did not confirm the requested model. Output withheld.');
  if (choice?.message?.tool_calls?.length || choice?.message?.function_call) return error('unexpected_tool_call', 'Unexpected tool invocation in provider output. Output withheld.');
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim()) return error('empty_provider_response', 'The provider returned no rewritten text.');
  return {status: 'complete', text, finish_reason: 'stop', fidelity: 'unverified', model: MODEL, processing_prompt_version: PROMPT_VERSION, processing_prompt_sha256: PROMPT_SHA256};
}
