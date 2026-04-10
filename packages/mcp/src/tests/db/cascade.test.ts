import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';
import { freshDb } from '../_helpers/fresh-db.js';

describe('triggers', () => {
  it('registers the 8 expected triggers', () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'notes_ai_fts', 'notes_au_fts', 'notes_ad_fts',
        'chunks_ai_fts', 'chunks_au_fts', 'chunks_ad_fts',
        'notes_ad_emb', 'chunks_ad_emb',
      ]),
    );
  });
});

it('deleting an atom cascades to its embedding', () => {
  const { db, close } = freshDb();
  db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
              VALUES ('n1','00000000-0000-0000-0000-000000000000','atom','t','c','[]','active','ai','h1',1,1)`).run();
  db.prepare(`INSERT INTO embeddings (owner_type, owner_id, model, dim, content_hash, vector, created_at)
              VALUES ('note','n1','m',1,'h1', x'00', 1)`).run();
  db.prepare("DELETE FROM notes WHERE id='n1'").run();
  const remaining = db.prepare("SELECT COUNT(*) as c FROM embeddings").get() as { c: number };
  expect(remaining.c).toBe(0);
  close();
});

it('deleting a document cascades chunks and their embeddings', () => {
  const { db, close } = freshDb();
  db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
              VALUES ('n2','00000000-0000-0000-0000-000000000000','document','t','c','[]','active','ai','h',1,1)`).run();
  db.prepare(`INSERT INTO chunks (id, note_id, position, heading_path, content, content_hash, created_at)
              VALUES ('c1','n2',0,'h','x','hc',1)`).run();
  db.prepare(`INSERT INTO embeddings (owner_type, owner_id, model, dim, content_hash, vector, created_at)
              VALUES ('chunk','c1','m',1,'hc', x'00', 1)`).run();
  db.prepare("DELETE FROM notes WHERE id='n2'").run();
  const chunks = db.prepare("SELECT COUNT(*) as c FROM chunks").get() as { c: number };
  const embs = db.prepare("SELECT COUNT(*) as c FROM embeddings").get() as { c: number };
  expect(chunks.c).toBe(0);
  expect(embs.c).toBe(0);
  close();
});

it('invariant: no orphan embeddings after any delete sequence', () => {
  const { db, close } = freshDb();
  const G = '00000000-0000-0000-0000-000000000000';
  // Seed 3 atoms
  for (let i = 0; i < 3; i++) {
    db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
                VALUES (?, ?, 'atom', 't', 'c', '[]', 'active', 'ai', 'h', 1, 1)`).run(`a${i}`, G);
    db.prepare(`INSERT INTO embeddings (owner_type, owner_id, model, dim, content_hash, vector, created_at)
                VALUES ('note', ?, 'm', 1, 'h', x'00', 1)`).run(`a${i}`);
  }
  // Seed 1 doc with 3 chunks + 3 chunk embeddings
  db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
              VALUES ('doc1', ?, 'document', 't', 'c', '[]', 'active', 'ai', 'h', 1, 1)`).run(G);
  for (let i = 0; i < 3; i++) {
    db.prepare(`INSERT INTO chunks (id, note_id, position, heading_path, content, content_hash, created_at)
                VALUES (?, 'doc1', ?, 'h', 'x', 'ch', 1)`).run(`c${i}`, i);
    db.prepare(`INSERT INTO embeddings (owner_type, owner_id, model, dim, content_hash, vector, created_at)
                VALUES ('chunk', ?, 'm', 1, 'ch', x'00', 1)`).run(`c${i}`);
  }
  // Delete 1 atom and the doc
  db.prepare(`DELETE FROM notes WHERE id='a0'`).run();
  db.prepare(`DELETE FROM notes WHERE id='doc1'`).run();
  const orphans = db.prepare(`
    SELECT COUNT(*) AS c FROM embeddings
    WHERE NOT (
      (owner_type='note'  AND owner_id IN (SELECT id FROM notes)) OR
      (owner_type='chunk' AND owner_id IN (SELECT id FROM chunks))
    )
  `).get() as { c: number };
  expect(orphans.c).toBe(0);
  // Remaining: 2 atoms (a1, a2) = 2 embeddings
  const total = db.prepare(`SELECT COUNT(*) AS c FROM embeddings`).get() as { c: number };
  expect(total.c).toBe(2);
  close();
});
