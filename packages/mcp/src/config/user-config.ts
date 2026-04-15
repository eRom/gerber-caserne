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
 * Keeps the streamable-HTTP bearer token persistent across restarts so it can
 * be mirrored in an Anthropic Vault `static_bearer` credential that is bound
 * to an IMMUTABLE `mcp_server_url`.
 */

export interface UserConfig {
  streamToken?: string;
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
