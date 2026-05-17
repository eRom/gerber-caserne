import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';
import { registerAllTools } from '../../tools/index.js';
import { startHttpServer } from '../../http/server.js';
import type { Server } from 'node:http';

describe('/health endpoint', () => {
  let db: ReturnType<typeof openDatabase>;
  let httpServer: Server;
  let port: number;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    applyMigrations(db);
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    registerAllTools(server, db);
    const result = await startHttpServer(server, db, { port: 0 });
    httpServer = result.httpServer;
    const addr = httpServer.address() as { port: number };
    port = addr.port;
  });

  afterEach(() => {
    httpServer.close();
    db.close();
  });

  it('returns ok:true with the DB path', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await res.json()) as { ok: boolean; dbPath?: string };
    expect(body.ok).toBe(true);
    expect(typeof body.dbPath).toBe('string');
  });
});
