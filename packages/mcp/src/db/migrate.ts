import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Database as BetterSqliteDb } from 'better-sqlite3';
import { DDL } from './ddl.js';
import { seed } from './seed.js';

export function applyMigrations(db: BetterSqliteDb): void {
  // Bootstrap migration journal (idempotent by design)
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY NOT NULL,
    applied_at INTEGER NOT NULL
  )`);

  const migrationsDir = new URL('./migrations/', import.meta.url);
  const migrationsPath = fileURLToPath(migrationsDir);

  const sqlFiles = readdirSync(migrationsPath)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of sqlFiles) {
    // Skip already-applied migrations (idempotence)
    const already = db
      .prepare('SELECT 1 FROM _migrations WHERE filename = ?')
      .get(file);
    if (already) continue;

    const sql = readFileSync(`${migrationsPath}/${file}`, 'utf-8');
    // Drizzle uses '--> statement-breakpoint' as a separator — split and exec each statement
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      db.exec(statement);
    }

    db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)').run(file, Date.now());
  }

  // Apply hand-written DDL (virtual tables, views, triggers)
  db.exec(DDL);

  // Seed initial data
  seed(db);
}
