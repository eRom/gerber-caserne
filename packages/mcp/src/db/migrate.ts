import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Database as BetterSqliteDb } from 'better-sqlite3';
import { DDL } from './ddl.js';
import { seed } from './seed.js';
import { checkChunkConfigVersion } from './app-meta.js';
import { cleanupStaleProcesses } from '../tools/runbook.js';

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
  // Triggers use DROP + CREATE so schema changes always take effect.
  db.exec(DDL);

  // One-time FTS5 rebuild: ensures FTS5 rowids match fts_source rowids.
  // Detects stale state by checking if any FTS5 rowid has no matching fts_source entry.
  const staleFts = db.prepare(
    `SELECT COUNT(*) AS c FROM notes_fts WHERE rowid NOT IN (SELECT fts_rowid FROM fts_source)`,
  ).get() as { c: number };

  if (staleFts.c > 0) {
    // Rebuild: drop and recreate FTS5 + fts_source, then re-insert with correct rowids.
    // FTS5 contentless tables don't support DELETE — must drop and recreate.
    db.exec(`DROP TABLE IF EXISTS notes_fts`);
    db.exec(`CREATE VIRTUAL TABLE notes_fts USING fts5(title, content, content='', content_rowid=rowid)`);
    db.exec(`DELETE FROM fts_source`);

    // Re-insert atoms
    const atoms = db.prepare(`SELECT rowid, id, title, content FROM notes WHERE kind = 'atom'`).all() as {
      rowid: number; id: string; title: string; content: string;
    }[];
    const insertFts = db.prepare(`INSERT INTO notes_fts(rowid, title, content) VALUES (?, ?, ?)`);
    const insertSrc = db.prepare(`INSERT INTO fts_source(fts_rowid, source_type, source_id) VALUES (?, ?, ?)`);
    for (const a of atoms) {
      insertFts.run(a.rowid, a.title, a.content);
      insertSrc.run(a.rowid, 'note', a.id);
    }

    // Re-insert chunks (with 1B offset)
    const chunkRows = db.prepare(`SELECT rowid, id, heading_path, content FROM chunks`).all() as {
      rowid: number; id: string; heading_path: string; content: string;
    }[];
    for (const c of chunkRows) {
      insertFts.run(1000000000 + c.rowid, c.heading_path ?? '', c.content);
      insertSrc.run(1000000000 + c.rowid, 'chunk', c.id);
    }
  }

  // Seed initial data
  seed(db);

  // Initialize / check chunk config version
  checkChunkConfigVersion(db);

  const cleaned = cleanupStaleProcesses(db);
  if (cleaned > 0) console.log(`[runbook] cleaned ${cleaned} stale process entries`);
}
