#!/usr/bin/env node
/**
 * Print the persisted Streamable HTTP bearer token. Generates + persists one
 * on first run. Writes to ~/.config/gerber/config.json (mode 600).
 *
 * Usage:
 *   pnpm mcp:token           print current token (generate if missing)
 *   pnpm mcp:token --rotate  force-regenerate (you must update the Vault credential)
 */
import { getStreamToken, regenerateStreamToken, getConfigPath } from '../config/user-config.js';

const rotate = process.argv.includes('--rotate');
const token = rotate ? regenerateStreamToken() : getStreamToken();

console.log(token);
console.error(`\nStored at: ${getConfigPath()}`);
if (rotate) {
  console.error('Token rotated — remember to update the Anthropic Vault credential.');
}
