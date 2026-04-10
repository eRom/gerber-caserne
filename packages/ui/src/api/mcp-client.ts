let rpcId = 0;

export class McpError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

export async function mcpCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });

  if (!res.ok) {
    throw new McpError(-1, `HTTP ${res.status}: ${res.statusText}`);
  }

  const body = await res.json();

  if (body.error) {
    throw new McpError(body.error.code, body.error.message);
  }

  return body.result as T;
}
