import type { Database } from 'better-sqlite3';
import { CHUNK_CONFIG } from '../config.js';

export function getMeta(db: Database, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(db: Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run(key, value);
}

export function checkChunkConfigVersion(db: Database): void {
  const stored = getMeta(db, 'chunk_config_version');
  const current = String(CHUNK_CONFIG.version);

  if (stored === undefined) {
    // Fresh DB — initialize
    setMeta(db, 'chunk_config_version', current);
    return;
  }

  if (stored !== current) {
    console.warn(`chunk config changed from ${stored} to ${current}, run pnpm mcp:reindex`);
  }
}

export function markChunkConfigReindexed(db: Database, version: number): void {
  setMeta(db, 'chunk_config_version', String(version));
}
