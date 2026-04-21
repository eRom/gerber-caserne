#!/usr/bin/env node
/**
 * Print gerber connector credentials. Generates + persists missing values
 * in ~/.config/gerber/config.json (mode 600).
 *
 * Usage:
 *   pnpm mcp:token                    print streamToken + OAuth client
 *   pnpm mcp:token --rotate           force-regenerate streamToken
 *   pnpm mcp:token --rotate-oauth     force-regenerate OAuth client_id + secret
 *   pnpm mcp:token --token-only       print only the stream Bearer token (backward compat)
 */
import {
  getStreamToken,
  regenerateStreamToken,
  getOAuthClient,
  regenerateOAuthClient,
  getPublicUrl,
  getConfigPath,
} from '../config/user-config.js';

const args = process.argv.slice(2);
const rotateStream = args.includes('--rotate');
const rotateOauth = args.includes('--rotate-oauth');
const tokenOnly = args.includes('--token-only');

const streamToken = rotateStream ? regenerateStreamToken() : getStreamToken();
const { clientId, clientSecret } = rotateOauth ? regenerateOAuthClient() : getOAuthClient();
const publicUrl = getPublicUrl();

if (tokenOnly) {
  // Backward-compatible terse output — only the Bearer for Managed Agents.
  console.log(streamToken);
  console.error(`\nStored at: ${getConfigPath()}`);
  if (rotateStream) {
    console.error('Token rotated — remember to update the Anthropic Vault credential.');
  }
  process.exit(0);
}

console.log('Managed Agent (Vault static_bearer)');
console.log('  Bearer token :', streamToken);
console.log();
console.log('claude.ai custom connector (OAuth)');
console.log('  URL          :', publicUrl ?? '(set GERBER_PUBLIC_URL or persist publicUrl in config)');
console.log('  Client ID    :', clientId);
console.log('  Client secret:', clientSecret);
console.log();
console.error(`Stored at: ${getConfigPath()}`);
if (rotateStream) {
  console.error('Bearer token rotated — update the Anthropic Vault credential.');
}
if (rotateOauth) {
  console.error('OAuth client rotated — re-paste the new Client ID/Secret in the claude.ai connector UI.');
}
if (!publicUrl) {
  console.error(
    '\nWarning: GERBER_PUBLIC_URL not set. OAuth endpoints will NOT be mounted and',
  );
  console.error(
    'claude.ai cannot connect. Export GERBER_PUBLIC_URL=https://<your-tunnel>.example.com',
  );
  console.error('or persist it via setPublicUrl(). Only the Managed Agent flow will work.');
}
