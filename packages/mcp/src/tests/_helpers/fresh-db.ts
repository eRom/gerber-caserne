import type { Database } from 'better-sqlite3';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';

export function freshDb(): { db: Database; close: () => void } {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  return { db, close: () => db.close() };
}
