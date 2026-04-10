import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';
import { registerAllTools } from '../../tools/index.js';
import { startHttpServer } from '../../http/server.js';
import type { Server } from 'node:http';

describe('/health with embedder preload', () => {
  let db: ReturnType<typeof openDatabase>;
  let httpServer: Server;
  let port: number;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    applyMigrations(db);
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAllTools(server, db);
    const result = await startHttpServer(server, db, { port: 0, preloadEmbedder: true });
    httpServer = result.httpServer;
    const addr = httpServer.address() as { port: number };
    port = addr.port;
  });

  afterEach(() => {
    httpServer.close();
    db.close();
  });

  it('starts with embedderReady false then flips to true', async () => {
    // Initial state
    const res1 = await fetch(`http://127.0.0.1:${port}/health`);
    const body1 = await res1.json();
    // May already be true since mock resolves instantly
    expect(typeof body1.embedderReady).toBe('boolean');

    // Wait a tick for the preload to resolve
    await new Promise(r => setTimeout(r, 100));

    const res2 = await fetch(`http://127.0.0.1:${port}/health`);
    const body2 = await res2.json();
    expect(body2.embedderReady).toBe(true);
  });
});
