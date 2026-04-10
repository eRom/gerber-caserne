#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase } from './db/index.js';
import { applyMigrations } from './db/migrate.js';
import { registerAllTools } from './tools/index.js';
import { startHttpServer } from './http/server.js';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const useUi = argv.includes('--ui');
const dbFlag = argv.indexOf('--db-path');
const dbPath = dbFlag >= 0 ? argv[dbFlag + 1]! : resolve(homedir(), '.agent-brain', 'brain.db');

// Ensure directory exists
mkdirSync(resolve(dbPath, '..'), { recursive: true });

const db = openDatabase(dbPath);
applyMigrations(db);
const server = new McpServer({ name: 'agent-brain', version: '0.1.0' });
registerAllTools(server, db);

if (useUi) {
  await startHttpServer(server, db);
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
