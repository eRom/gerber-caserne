import type { Database as BetterSqliteDb } from 'better-sqlite3';

const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';
const CASERNE_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

export function seed(db: BetterSqliteDb): void {
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, slug, name, created_at, updated_at)
     VALUES (?, 'global', 'Global', ?, ?)`,
  ).run(GLOBAL_PROJECT_ID, now, now);

  db.prepare(
    `INSERT OR IGNORE INTO projects (id, slug, name, description, color, created_at, updated_at)
     VALUES (?, 'caserne', 'Caserne', 'Base de connaissances cross-projets — design system, conventions, preferences, patterns', '#FFAF5F', ?, ?)`,
  ).run(CASERNE_PROJECT_ID, now, now);
}
