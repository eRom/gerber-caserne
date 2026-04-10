import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate } from '../../tools/notes.js';

describe('note_create (atom)', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('creates an atom with embedding', async () => {
    const result = await noteCreate(db, {
      kind: 'atom',
      title: 'Gotcha tip',
      content: 'Always use camelCase',
      tags: ['gotcha'],
      source: 'ai',
    });
    expect(result.ok).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.item.kind).toBe('atom');
    expect(result.item.tags).toEqual(['gotcha']);

    // Verify note in DB
    const noteRow = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.id) as any;
    expect(noteRow).toBeDefined();
    expect(noteRow.tags).toBe('["gotcha"]'); // stored as JSON string

    // Verify 1 embedding with owner_type='note'
    const embs = db.prepare("SELECT * FROM embeddings WHERE owner_type='note' AND owner_id = ?").all(result.id) as any[];
    expect(embs).toHaveLength(1);
    expect(embs[0].dim).toBe(768);

    // Verify FTS5 entry exists (atom goes into FTS)
    const fts = db.prepare("SELECT * FROM notes_fts WHERE notes_fts MATCH ?").all('camelCase') as any[];
    expect(fts.length).toBeGreaterThanOrEqual(1);
  });
});
