let rpcId = 0;

const BASE_URL = process.env.GERBER_URL ?? 'http://127.0.0.1:4000';

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
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });

  if (!res.ok) {
    throw new McpError(-1, `HTTP ${res.status}: ${res.statusText}`);
  }

  const body = (await res.json()) as { result?: T; error?: { code: number; message: string } };

  if (body.error) {
    throw new McpError(body.error.code, body.error.message);
  }

  return body.result as T;
}
