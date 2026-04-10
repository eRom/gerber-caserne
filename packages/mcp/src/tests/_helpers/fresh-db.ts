import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';

export function freshDb() {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  return { db, close: () => db.close() };
}
