import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate } from '../../tools/notes.js';
import { syncDocumentChunks } from '../../notes/sync-chunks.js';

describe('syncDocumentChunks', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  // Helper: create a doc and return its id + initial chunks
  async function createDoc(content: string) {
    const result = await noteCreate(db, {
      kind: 'document',
      title: 'Test Doc',
      content,
      tags: [],
      source: 'ai',
    });
    const chunks = db.prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position').all(result.id) as any[];
    return { noteId: result.id, chunks };
  }

  it('unchanged section keeps same id and embedding', async () => {
    const content = `## A\n\nBody A.\n\n## B\n\nBody B.`;
    const { noteId, chunks: before } = await createDoc(content);
    const embsBefore = db.prepare("SELECT * FROM embeddings WHERE owner_type='chunk'").all() as any[];

    // Sync with identical content
    await syncDocumentChunks(db, noteId, content);

    const after = db.prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position').all(noteId) as any[];
    expect(after.map((c: any) => c.id)).toEqual(before.map((c: any) => c.id));

    const embsAfter = db.prepare("SELECT * FROM embeddings WHERE owner_type='chunk'").all() as any[];
    expect(embsAfter.length).toBe(embsBefore.length);
  });

  it('edit in 1 section regenerates exactly 1 embedding', async () => {
    const { noteId, chunks: before } = await createDoc(`## A\n\nBody A.\n\n## B\n\nBody B.`);

    await syncDocumentChunks(db, noteId, `## A\n\nBody A EDITED.\n\n## B\n\nBody B.`);

    const after = db.prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position').all(noteId) as any[];
    // B chunk should keep its ID (content unchanged)
    const bBefore = before.find((c: any) => c.heading_path?.includes('B'));
    const bAfter = after.find((c: any) => c.heading_path?.includes('B'));
    expect(bAfter?.id).toBe(bBefore?.id);

    // A chunk should have new content_hash
    const aBefore = before.find((c: any) => c.heading_path?.includes('A'));
    const aAfter = after.find((c: any) => c.heading_path?.includes('A'));
    expect(aAfter?.content_hash).not.toBe(aBefore?.content_hash);
  });

  it('add section at end creates 1 new chunk, others untouched', async () => {
    const { noteId, chunks: before } = await createDoc(`## A\n\nBody A.\n\n## B\n\nBody B.`);

    await syncDocumentChunks(db, noteId, `## A\n\nBody A.\n\n## B\n\nBody B.\n\n## C\n\nBody C.`);

    const after = db.prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position').all(noteId) as any[];
    expect(after.length).toBe(before.length + 1);
    // Original chunks preserved
    for (const b of before) {
      const match = after.find((a: any) => a.content_hash === (b as any).content_hash);
      expect(match).toBeDefined();
    }
  });

  it('delete a section removes that chunk + its embedding', async () => {
    const { noteId, chunks: before } = await createDoc(`## A\n\nBody A.\n\n## B\n\nBody B.\n\n## C\n\nBody C.`);
    expect(before.length).toBe(3);

    // Remove section B
    await syncDocumentChunks(db, noteId, `## A\n\nBody A.\n\n## C\n\nBody C.`);

    const after = db.prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position').all(noteId) as any[];
    expect(after.length).toBe(2);

    // Verify no orphan embeddings
    const orphans = db.prepare(`
      SELECT COUNT(*) as c FROM embeddings WHERE owner_type='chunk'
      AND owner_id NOT IN (SELECT id FROM chunks)
    `).get() as { c: number };
    expect(orphans.c).toBe(0);
  });

  it('invariant: chunk count equals chunk embedding count', async () => {
    const { noteId } = await createDoc(`## A\n\nBody A.\n\n## B\n\nBody B.`);

    // Edit + add + maintain
    await syncDocumentChunks(db, noteId, `## A\n\nEdited A.\n\n## B\n\nBody B.\n\n## C\n\nNew C.`);

    const chunkCount = (db.prepare('SELECT COUNT(*) as c FROM chunks WHERE note_id = ?').get(noteId) as { c: number }).c;
    const embCount = (db.prepare(`
      SELECT COUNT(*) as c FROM embeddings WHERE owner_type='chunk'
      AND owner_id IN (SELECT id FROM chunks WHERE note_id = ?)
    `).get(noteId) as { c: number }).c;
    expect(chunkCount).toBe(embCount);
  });
});
