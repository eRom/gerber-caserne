import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Database as BetterSqliteDb } from 'better-sqlite3';
import { DDL } from './ddl.js';

export function applyMigrations(db: BetterSqliteDb): void {
  const migrationsDir = new URL('./migrations/', import.meta.url);
  const migrationsPath = fileURLToPath(migrationsDir);

  const sqlFiles = readdirSync(migrationsPath)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of sqlFiles) {
    const sql = readFileSync(`${migrationsPath}/${file}`, 'utf-8');
    // Drizzle uses '--> statement-breakpoint' as a separator — split and exec each statement
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      db.exec(statement);
    }
  }

  // Apply hand-written DDL (virtual tables, views, triggers)
  db.exec(DDL);
}
