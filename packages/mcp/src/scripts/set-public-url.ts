#!/usr/bin/env node
/**
 * Persist the public HTTPS URL used for OAuth issuer / resource server metadata.
 *
 * Usage:
 *   pnpm mcp:set-url https://gerber.example.com
 */
import { setPublicUrl, getConfigPath } from '../config/user-config.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: pnpm mcp:set-url <https-url>');
  process.exit(1);
}
try {
  new URL(url);
} catch {
  console.error(`Not a valid URL: ${url}`);
  process.exit(1);
}
setPublicUrl(url);
console.log(`publicUrl persisted to ${getConfigPath()}`);
console.log('Restart the MCP server for OAuth endpoints to mount.');
