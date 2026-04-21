import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';

/**
 * User-facing config for gerber.
 *
 * Stored at ~/.config/gerber/config.json (mode 600).
 * Mirrors the convention used by the vault skill (~/.config/gerber-vault/).
 *
 * Persists:
 * - `streamToken` : Bearer for the Streamable HTTP transport (Managed Agents).
 * - `oauthClientId` / `oauthClientSecret` : single pre-registered OAuth client
 *   used by claude.ai custom connector. Skips Dynamic Client Registration.
 * - `publicUrl` : public HTTPS URL exposed by the Cloudflare tunnel
 *   (e.g. https://gerber.romain-ecarnot.com). Used as OAuth issuer + resource
 *   server URL. Env var GERBER_PUBLIC_URL overrides the persisted value.
 */

export interface UserConfig {
  streamToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  publicUrl?: string;
}

const CONFIG_DIR = resolve(homedir(), '.config', 'gerber');
const CONFIG_PATH = resolve(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_PATH;
}

function readConfig(): UserConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as UserConfig;
  } catch {
    return {};
  }
}

function writeConfig(cfg: UserConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  // chmodSync is a no-op if the file was just created with mode 0o600, but it
  // guards against pre-existing files with looser perms.
  chmodSync(CONFIG_PATH, 0o600);
}

/**
 * Return the persisted stream token. Generates + writes one on first call.
 */
export function getStreamToken(): string {
  const cfg = readConfig();
  if (cfg.streamToken && cfg.streamToken.length > 0) return cfg.streamToken;
  const token = randomBytes(32).toString('hex');
  writeConfig({ ...cfg, streamToken: token });
  return token;
}

/**
 * Force a new token to be generated and persisted. Returns the new token.
 * Callers must update their Anthropic Vault credential afterwards.
 */
export function regenerateStreamToken(): string {
  const cfg = readConfig();
  const token = randomBytes(32).toString('hex');
  writeConfig({ ...cfg, streamToken: token });
  return token;
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/**
 * Return the persisted OAuth client credentials. Generates + writes on first
 * call. claude.ai users paste these into the custom connector UI.
 */
export function getOAuthClient(): OAuthClient {
  const cfg = readConfig();
  if (cfg.oauthClientId && cfg.oauthClientSecret) {
    return { clientId: cfg.oauthClientId, clientSecret: cfg.oauthClientSecret };
  }
  const clientId = `gerber-${randomBytes(8).toString('hex')}`;
  const clientSecret = randomBytes(32).toString('hex');
  writeConfig({ ...cfg, oauthClientId: clientId, oauthClientSecret: clientSecret });
  return { clientId, clientSecret };
}

/**
 * Force a new OAuth client_id + client_secret to be generated. Callers must
 * re-paste the new values into the claude.ai connector UI.
 */
export function regenerateOAuthClient(): OAuthClient {
  const cfg = readConfig();
  const clientId = `gerber-${randomBytes(8).toString('hex')}`;
  const clientSecret = randomBytes(32).toString('hex');
  writeConfig({ ...cfg, oauthClientId: clientId, oauthClientSecret: clientSecret });
  return { clientId, clientSecret };
}

/**
 * Public HTTPS URL at which this server is reachable from the internet (Cloudflare
 * tunnel). Used as OAuth issuer + resource server URL.
 *
 * Resolution order:
 *   1. GERBER_PUBLIC_URL env var
 *   2. persisted `publicUrl` in config.json
 *   3. undefined (OAuth disabled)
 */
export function getPublicUrl(): string | undefined {
  const fromEnv = process.env.GERBER_PUBLIC_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const cfg = readConfig();
  return cfg.publicUrl;
}

/**
 * Persist the public URL in config.json.
 */
export function setPublicUrl(url: string): void {
  const cfg = readConfig();
  writeConfig({ ...cfg, publicUrl: url });
}
