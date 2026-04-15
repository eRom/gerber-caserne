import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';
import { registerAllTools } from '../../tools/index.js';
import { startHttpServer } from '../../http/server.js';
import type { Server } from 'node:http';

const TOKEN = 'test-token-abc123';

// Parse an SSE response body into the array of JSON-RPC messages it carries.
// The MCP Streamable transport defaults to SSE for POST responses in stateful
// mode, so we need a tiny parser for the tests.
function parseSse(body: string): any[] {
  const out: any[] = [];
  for (const block of body.split(/\n\n/)) {
    const dataLines = block
      .split(/\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    if (dataLines.length === 0) continue;
    const raw = dataLines.join('\n');
    try {
      out.push(JSON.parse(raw));
    } catch {
      // ignore non-JSON frames
    }
  }
  return out;
}

async function parseBody(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (ct.includes('text/event-stream')) {
    const msgs = parseSse(text);
    return msgs.length === 1 ? msgs[0] : msgs;
  }
  if (ct.includes('application/json')) return JSON.parse(text);
  return text;
}

describe('Streamable HTTP transport (/mcp/stream)', () => {
  let db: ReturnType<typeof openDatabase>;
  let httpServer: Server;
  let port: number;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    applyMigrations(db);
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAllTools(server, db);
    const result = await startHttpServer(server, db, {
      port: 0,
      preloadEmbedder: false,
      exposeStream: true,
      streamToken: TOKEN,
    });
    httpServer = result.httpServer;
    const addr = httpServer.address() as { port: number };
    port = addr.port;
  });

  afterEach(() => {
    httpServer.close();
    db.close();
  });

  const url = () => `http://127.0.0.1:${port}/mcp/stream`;
  const authHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${TOKEN}`,
  };

  it('rejects requests without a valid bearer token', async () => {
    const res = await fetch(url(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('accepts initialize and returns a session id', async () => {
    const res = await fetch(url(), {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '0.0.0' },
        },
      }),
    });
    expect(res.status).toBe(200);
    const sid = res.headers.get('mcp-session-id');
    expect(sid).toBeTruthy();
    const body = await parseBody(res);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.result).toBeDefined();
    expect(body.result.protocolVersion).toBeTruthy();
  });

  it('tools/list returns registered gerber tools on the same session', async () => {
    // Initialize first
    const init = await fetch(url(), {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '0.0.0' },
        },
      }),
    });
    await init.text();
    const sid = init.headers.get('mcp-session-id')!;
    expect(sid).toBeTruthy();

    // Send the required initialized notification (no response expected, 202)
    const initNotif = await fetch(url(), {
      method: 'POST',
      headers: { ...authHeaders, 'mcp-session-id': sid },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    });
    await initNotif.text();

    // Then list tools
    const list = await fetch(url(), {
      method: 'POST',
      headers: { ...authHeaders, 'mcp-session-id': sid },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    expect(list.status).toBe(200);
    const body = await parseBody(list);
    expect(body.result).toBeDefined();
    expect(Array.isArray(body.result.tools)).toBe(true);
    const names = body.result.tools.map((t: any) => t.name);
    expect(names).toContain('project_list');
    expect(names).toContain('note_create');
    expect(names).toContain('search');
  });

  it('rejects a POST with unknown session id', async () => {
    const res = await fetch(url(), {
      method: 'POST',
      headers: { ...authHeaders, 'mcp-session-id': 'does-not-exist' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/list', params: {} }),
    });
    // Either 400 (our guard) or 404 (transport) — both are non-2xx and non-success.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('DELETE terminates the session', async () => {
    const init = await fetch(url(), {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '0.0.0' },
        },
      }),
    });
    await init.text();
    const sid = init.headers.get('mcp-session-id')!;

    const del = await fetch(url(), {
      method: 'DELETE',
      headers: { ...authHeaders, 'mcp-session-id': sid },
    });
    expect(del.status).toBeLessThan(500);

    // Subsequent request with the same sid should no longer be valid
    const after = await fetch(url(), {
      method: 'POST',
      headers: { ...authHeaders, 'mcp-session-id': sid },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    expect(after.status).toBeGreaterThanOrEqual(400);
  });

  it('regression: the legacy JSON-RPC bridge on /mcp still works', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'project_list', params: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.jsonrpc).toBe('2.0');
    expect(body.result).toBeDefined();
  });
});

describe('Streamable HTTP transport disabled by default', () => {
  let db: ReturnType<typeof openDatabase>;
  let httpServer: Server;
  let port: number;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    applyMigrations(db);
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAllTools(server, db);
    const result = await startHttpServer(server, db, { port: 0, preloadEmbedder: false });
    httpServer = result.httpServer;
    const addr = httpServer.address() as { port: number };
    port = addr.port;
  });

  afterEach(() => {
    httpServer.close();
    db.close();
  });

  it('does not mount /mcp/stream without exposeStream', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    // Without exposeStream the route falls through to the SPA fallback, which
    // returns HTML / 404 depending on whether the UI is built. Either way, it
    // must NOT return a JSON-RPC success.
    expect(res.status).not.toBe(200);
  });
});
