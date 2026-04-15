#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase } from './db/index.js';
import { applyMigrations } from './db/migrate.js';
import { registerAllTools } from './tools/index.js';
import { startHttpServer } from './http/server.js';
import { getStreamToken } from './config/user-config.js';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const useUi = argv.includes('--ui');
const exposeStream = argv.includes('--stream') || argv.includes('--expose');
const dbFlag = argv.indexOf('--db-path');
const dbPath = dbFlag >= 0 ? argv[dbFlag + 1]! : resolve(homedir(), '.agent-brain', 'brain.db');
const tokenFlag = argv.indexOf('--stream-token');
const cliToken = tokenFlag >= 0 ? argv[tokenFlag + 1] : undefined;

// Ensure directory exists
mkdirSync(resolve(dbPath, '..'), { recursive: true });

const db = openDatabase(dbPath);
applyMigrations(db);
const server = new McpServer({ name: 'gerber', version: '0.1.0' });
registerAllTools(server, db);

if (useUi || exposeStream) {
  // Token resolution precedence:
  //   1. --stream-token <tok> CLI flag
  //   2. GERBER_STREAM_TOKEN env var
  //   3. persisted token in ~/.config/gerber/config.json (generated on first use)
  const streamToken = exposeStream
    ? (cliToken || process.env.GERBER_STREAM_TOKEN || getStreamToken())
    : undefined;

  const httpOpts: { exposeStream?: boolean; streamToken?: string } = { exposeStream };
  if (streamToken !== undefined) httpOpts.streamToken = streamToken;
  await startHttpServer(server, db, httpOpts);

  if (exposeStream && streamToken) {
    console.log(
      `Streamable HTTP endpoint exposed at /mcp/stream (bearer auth required). ` +
      `Run "pnpm mcp:token" to print the token.`,
    );
  }
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
