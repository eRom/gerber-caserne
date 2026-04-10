import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate, noteGet, noteDelete, noteList, noteUpdate } from '../../tools/notes.js';


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

describe('note_create (document)', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('creates a document with chunks and chunk embeddings', async () => {
    const content = `# Doc Title\n\n## Section A\n\nAlpha body.\n\n## Section B\n\nBeta body.`;
    const result = await noteCreate(db, {
      kind: 'document',
      title: 'My Doc',
      content,
      tags: ['doc-tag'],
      source: 'human',
    });
    expect(result.ok).toBe(true);
    expect(result.item.kind).toBe('document');

    // Verify chunks exist
    const chunks = db.prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position').all(result.id) as any[];
    expect(chunks.length).toBeGreaterThanOrEqual(2); // At least 2 sections

    // Verify embeddings are chunk-level, NOT note-level
    const noteEmbs = db.prepare("SELECT COUNT(*) as c FROM embeddings WHERE owner_type='note' AND owner_id = ?").get(result.id) as { c: number };
    expect(noteEmbs.c).toBe(0); // documents don't get note-level embeddings

    const chunkEmbs = db.prepare("SELECT COUNT(*) as c FROM embeddings WHERE owner_type='chunk'").get() as { c: number };
    expect(chunkEmbs.c).toBe(chunks.length); // 1 embedding per chunk
  });
});

describe('note_get', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('returns atom without chunks', async () => {
    const { id } = await noteCreate(db, { kind: 'atom', title: 'A', content: 'c', tags: [], source: 'ai' });
    const result = noteGet(db, { id });
    expect(result.item.id).toBe(id);
    expect(result.item.kind).toBe('atom');
    expect(result.item.chunks).toBeUndefined();
  });

  it('returns document with chunks', async () => {
    const { id } = await noteCreate(db, { kind: 'document', title: 'D', content: '## A\n\nBody.\n\n## B\n\nMore.', tags: [], source: 'ai' });
    const result = noteGet(db, { id });
    expect(result.item.kind).toBe('document');
    expect(result.item.chunks).toBeDefined();
    expect(result.item.chunks!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('note_delete', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('deletes note and cascades', async () => {
    const { id } = await noteCreate(db, { kind: 'atom', title: 'Del', content: 'c', tags: [], source: 'ai' });
    const result = noteDelete(db, { id });
    expect(result.ok).toBe(true);
    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    expect(row).toBeUndefined();
    // Verify embedding cleaned up via trigger
    const embs = db.prepare("SELECT COUNT(*) as c FROM embeddings WHERE owner_id = ?").get(id) as { c: number };
    expect(embs.c).toBe(0);
  });
});

describe('note_list', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('filters by kind', async () => {
    await noteCreate(db, { kind: 'atom', title: 'A1', content: 'c', tags: [], source: 'ai' });
    await noteCreate(db, { kind: 'document', title: 'D1', content: '## H\n\nBody.', tags: [], source: 'ai' });
    const result = noteList(db, { kind: 'atom' });
    expect(result.items.every((n: any) => n.kind === 'atom')).toBe(true);
  });

  it('filters by tags_any via json_each', async () => {
    await noteCreate(db, { kind: 'atom', title: 'T1', content: 'c', tags: ['alpha', 'beta'], source: 'ai' });
    await noteCreate(db, { kind: 'atom', title: 'T2', content: 'c', tags: ['gamma'], source: 'ai' });
    const result = noteList(db, { tags_any: ['alpha'] });
    expect(result.items.length).toBe(1);
    expect(result.items[0].title).toBe('T1');
  });

  it('tags_all and tags_any are mutually exclusive', () => {
    expect(() => noteList(db, { tags_all: ['a'], tags_any: ['b'] })).toThrow();
  });

  it('filters by project_id', async () => {
    const projId = crypto.randomUUID();
    db.prepare(`INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, 'test', 'Test', 1, 1)`).run(projId);
    await noteCreate(db, { kind: 'atom', title: 'P1', content: 'c', tags: [], source: 'ai', projectId: projId });
    await noteCreate(db, { kind: 'atom', title: 'P2', content: 'c', tags: [], source: 'ai' });
    const result = noteList(db, { projectId: projId });
    expect(result.items.length).toBe(1);
    expect(result.items[0].title).toBe('P1');
  });

  it('supports pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await noteCreate(db, { kind: 'atom', title: `N${i}`, content: `c${i}`, tags: [], source: 'ai' });
    }
    const page1 = noteList(db, { limit: 2, offset: 0 });
    const page2 = noteList(db, { limit: 2, offset: 2 });
    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBe(2);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
  });
});

describe('note_update', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('patches title only — no re-embed', async () => {
    const { id } = await noteCreate(db, { kind: 'atom', title: 'Before', content: 'x', tags: [], source: 'ai' });
    const embsBefore = db.prepare("SELECT COUNT(*) as c FROM embeddings").get() as { c: number };

    const result = await noteUpdate(db, { id, title: 'After' });
    expect(result.ok).toBe(true);
    expect(result.item.title).toBe('After');

    const embsAfter = db.prepare("SELECT COUNT(*) as c FROM embeddings").get() as { c: number };
    expect(embsAfter.c).toBe(embsBefore.c); // no new embeddings
  });

  it('patches content on atom — re-embeds', async () => {
    const { id } = await noteCreate(db, { kind: 'atom', title: 'A', content: 'original', tags: [], source: 'ai' });
    const embBefore = db.prepare("SELECT content_hash FROM embeddings WHERE owner_id = ?").get(id) as { content_hash: string };

    await noteUpdate(db, { id, content: 'updated content' });

    const embAfter = db.prepare("SELECT content_hash FROM embeddings WHERE owner_id = ?").get(id) as { content_hash: string };
    expect(embAfter.content_hash).not.toBe(embBefore.content_hash);
  });

  it('patches content on document — delegates to syncDocumentChunks', async () => {
    const { id } = await noteCreate(db, {
      kind: 'document', title: 'D', content: '## A\n\nBody A.\n\n## B\n\nBody B.', tags: [], source: 'ai',
    });
    const chunksBefore = db.prepare('SELECT COUNT(*) as c FROM chunks WHERE note_id = ?').get(id) as { c: number };

    await noteUpdate(db, { id, content: '## A\n\nBody A.\n\n## B\n\nBody B.\n\n## C\n\nNew C.' });

    const chunksAfter = db.prepare('SELECT COUNT(*) as c FROM chunks WHERE note_id = ?').get(id) as { c: number };
    expect(chunksAfter.c).toBe(chunksBefore.c + 1);
  });

  it('unchanged content (same hash) — no re-embed', async () => {
    const { id } = await noteCreate(db, { kind: 'atom', title: 'A', content: 'same', tags: [], source: 'ai' });
    const embBefore = db.prepare("SELECT created_at FROM embeddings WHERE owner_id = ?").get(id) as { created_at: number };

    await noteUpdate(db, { id, content: 'same' }); // same content

    const embAfter = db.prepare("SELECT created_at FROM embeddings WHERE owner_id = ?").get(id) as { created_at: number };
    expect(embAfter.created_at).toBe(embBefore.created_at); // unchanged
  });

  it('patches tags', async () => {
    const { id } = await noteCreate(db, { kind: 'atom', title: 'T', content: 'c', tags: ['a'], source: 'ai' });
    await noteUpdate(db, { id, tags: ['a', 'b'] });
    const result = noteGet(db, { id });
    expect(result.item.tags).toEqual(['a', 'b']);
  });
});
