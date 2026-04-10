import { copyFileSync, statSync } from 'node:fs';
import type { Database } from 'better-sqlite3';

export function checkpointAndCopy(db: Database, destination: string): number {
  db.pragma('wal_checkpoint(TRUNCATE)');
  copyFileSync(db.name, destination);
  return statSync(destination).size;
}
