import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';
import { registerAllTools } from '../../tools/index.js';
import { startHttpServer } from '../../http/server.js';
import type { Server } from 'node:http';

describe('HTTP JSON-RPC bridge', () => {
  let db: ReturnType<typeof openDatabase>;
  let httpServer: Server;
  let port: number;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    applyMigrations(db);
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAllTools(server, db);

    // Start on ephemeral port
    const result = await startHttpServer(server, db, { port: 0 });
    httpServer = result.httpServer;
    const addr = httpServer.address() as { port: number };
    port = addr.port;
  });

  afterEach(() => {
    httpServer.close();
    db.close();
  });

  it('POST /mcp with project_list returns JSON-RPC result', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'project_list', params: {} }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(1);
    expect(body.result).toBeDefined();
    // The result should be the MCP tool result (which wraps the actual tool output)
  });

  it('POST /mcp with unknown method returns error', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'nonexistent_tool', params: {} }),
    });
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(-32601); // Method not found
  });

  it('GET /health returns status', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('embedderReady');
  });
});
