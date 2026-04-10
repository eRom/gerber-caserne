import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate } from '../../tools/notes.js';
import { searchTool } from '../../tools/search.js';

describe('search tool', () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = freshDb());
    await noteCreate(db, { kind: 'atom', title: 'TypeScript tips', content: 'Use strict mode always', tags: ['ts'], source: 'ai' });
    await noteCreate(db, { kind: 'atom', title: 'SQLite tricks', content: 'WAL mode for concurrency', tags: ['db'], source: 'human' });
    await noteCreate(db, { kind: 'document', title: 'Full Guide', content: '## Intro\n\nIntro text.\n\n## Details\n\nDetail text.', tags: ['guide'], source: 'ai' });
  });
  afterEach(() => close());

  it('mode fulltext dispatches correctly', async () => {
    const result = await searchTool(db, { query: 'TypeScript', mode: 'fulltext', limit: 10 });
    expect(result.mode).toBe('fulltext');
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
  });

  it('mode semantic dispatches correctly', async () => {
    const result = await searchTool(db, { query: 'database optimization', mode: 'semantic', limit: 10 });
    expect(result.mode).toBe('semantic');
  });

  it('mode hybrid dispatches correctly', async () => {
    const result = await searchTool(db, { query: 'strict mode', mode: 'hybrid', limit: 10 });
    expect(result.mode).toBe('hybrid');
  });

  it('tags_all and tags_any are mutually exclusive', async () => {
    await expect(searchTool(db, { query: 'x', mode: 'fulltext', tags_all: ['a'], tags_any: ['b'] })).rejects.toThrow();
  });

  it('hydrates hits with parent metadata', async () => {
    const result = await searchTool(db, { query: 'TypeScript', mode: 'fulltext', limit: 10 });
    for (const hit of result.hits) {
      expect(hit.parent).toBeDefined();
      expect(hit.parent.noteId).toBeDefined();
      expect(hit.parent.title).toBeDefined();
      expect(hit.parent.kind).toBeDefined();
      expect(hit.parent.projectId).toBeDefined();
      expect(hit.parent.tags).toBeInstanceOf(Array);
      expect(hit.parent.status).toBeDefined();
    }
  });

  it('chunk hits have chunk metadata', async () => {
    // Semantic search may return chunk hits from the document
    const result = await searchTool(db, { query: 'intro text details', mode: 'semantic', limit: 10 });
    const chunkHits = result.hits.filter(h => h.ownerType === 'chunk');
    for (const hit of chunkHits) {
      expect(hit.chunk).toBeDefined();
      expect(hit.chunk!.headingPath).toBeDefined();
      expect(hit.chunk!.position).toBeDefined();
    }
  });
});
