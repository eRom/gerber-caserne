import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Translate a JSON-RPC 2.0 request into an MCP tool call and return
 * a JSON-RPC 2.0 response envelope.
 *
 * NOTE: `_registeredTools` is a **private** SDK surface (underscore prefix).
 * It is an object `{ [name]: { handler, inputSchema, ... } }`.
 * Brittle to @modelcontextprotocol/sdk upgrades — re-verify this field
 * still exists on every bump.
 */
export async function handleJsonRpc(server: McpServer, body: unknown) {
  const { jsonrpc, id, method, params } = body as {
    jsonrpc?: string;
    id?: number | string;
    method?: string;
    params?: Record<string, unknown>;
  };

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid JSON-RPC version' } };
  }

  if (!method) {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Missing method' } };
  }

  // Access registered tools — private SDK surface
  const tools = (server as any)._registeredTools as
    | Record<string, { handler: (args: any, extra: any) => Promise<any>; inputSchema?: any; enabled?: boolean }>
    | undefined;

  const tool = tools?.[method];

  if (!tool) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }

  try {
    const result = await tool.handler(params || {}, { signal: AbortSignal.timeout(30_000) });
    // MCP tool result shape: { content: [{ type: 'text', text: string }] }
    // Extract the actual data for the JSON-RPC response
    const text = result.content?.[0]?.text;
    const data = text ? JSON.parse(text) : result;
    return { jsonrpc: '2.0', id, result: data };
  } catch (err: any) {
    return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message || 'Internal error' } };
  }
}
