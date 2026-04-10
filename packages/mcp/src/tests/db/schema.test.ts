import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';

describe('openDatabase', () => {
  it('sets all required pragmas in correct order', () => {
    const db = openDatabase(':memory:');
    const pragmas = {
      journal_mode: db.pragma('journal_mode', { simple: true }),
      busy_timeout: db.pragma('busy_timeout', { simple: true }),
      foreign_keys: db.pragma('foreign_keys', { simple: true }),
      recursive_triggers: db.pragma('recursive_triggers', { simple: true }),
    };
    // :memory: refuses WAL silently → fall back to 'memory'. Both are valid.
    expect(['wal', 'memory']).toContain(pragmas.journal_mode);
    expect(pragmas.busy_timeout).toBe(5000);
    expect(pragmas.foreign_keys).toBe(1);
    expect(pragmas.recursive_triggers).toBe(1);
    db.close();
  });
});

it('applyMigrations creates all tables, view, and fts', () => {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
    .all() as { name: string }[];
  const names = tables.map((t) => t.name);
  expect(names).toEqual(
    expect.arrayContaining(['projects', 'notes', 'chunks', 'embeddings', 'app_meta', 'notes_fts', 'embedding_owners']),
  );
  db.close();
});

it('seeds the global project on fresh DB', () => {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  const row = db
    .prepare("SELECT id, slug, name FROM projects WHERE id = ?")
    .get('00000000-0000-0000-0000-000000000000') as { id: string; slug: string; name: string } | undefined;
  expect(row).toBeDefined();
  expect(row!.slug).toBe('global');
  expect(row!.name).toBe('Global');
});

it('seed is idempotent', () => {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  applyMigrations(db);
  const count = db.prepare("SELECT COUNT(*) as c FROM projects WHERE slug='global'").get() as { c: number };
  expect(count.c).toBe(1);
});
