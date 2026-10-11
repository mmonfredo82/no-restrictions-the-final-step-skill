import { createMcpHandler } from 'agents/mcp/server';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { configurationStatus, rewriteSelectedText } from '../shared/core.mjs';
import { createWorker } from './routes.mjs';
import { configuredOrigin } from './security.mjs';

export function createServer(env) {
  const server = new McpServer({
    name: 'No Restrictions The Final Step Skill',
    version: '1.0.0',
  });
  server.registerTool('getConfigurationStatus', {
    description: 'Check local configuration without making a provider request. Does not test the key or model availability.',
    inputSchema: z.strictObject({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const result = configurationStatus(env);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: false,
    };
  });
  server.registerTool('rewriteSelectedText', {
    description: 'Send only the explicitly selected text to OpenRouter and the configured Qwen provider after the user approves this specific external processing call. May incur provider charges. Approval must be obtained by the caller; the boolean is an assertion, not independent evidence of consent.',
    inputSchema: z.strictObject({
      selected_text: z.string().min(1).describe('Only the text the user explicitly selected for this call.'),
      approved_for_this_call: z.literal(true).describe('True only after explicit user authorization for this call.'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (args) => {
    const result = await rewriteSelectedText(args, env);
    if (result.status === 'complete') {
      const { text, ...metadata } = result;
      return { content: [{ type: 'text', text }], structuredContent: metadata, isError: false };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: true,
    };
  });
  return server;
}

export default createWorker({
  configurationStatus,
  rewriteSelectedText,
  handleMcp(request, env, ctx) {
    const hostname = new URL(configuredOrigin(env)).hostname;
    // The route/auth middleware already checks the exact scheme, host, and port.
    // Restrict the SDK too; do not use wildcard CORS or wildcard allowed Origins.
    return createMcpHandler(() => createServer(env), {
      route: '/mcp',
      corsOptions: false,
      allowedHostnames: [hostname],
      allowedOriginHostnames: [hostname],
    })(request, env, ctx);
  },
});
