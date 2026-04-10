import type { Database as BetterSqliteDb } from 'better-sqlite3';

const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

export function seed(db: BetterSqliteDb): void {
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, slug, name, created_at, updated_at)
     VALUES (?, 'global', 'Global', ?, ?)`,
  ).run(GLOBAL_PROJECT_ID, now, now);
}
