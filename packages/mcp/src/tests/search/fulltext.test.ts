import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate } from '../../tools/notes.js';
import { fulltextSearch } from '../../search/fulltext.js';

describe('fulltextSearch', () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = freshDb());
    // Seed corpus
    await noteCreate(db, { kind: 'atom', title: 'TypeScript Strict Mode', content: 'Enable strict mode in tsconfig for safer code', tags: ['typescript', 'config'], source: 'ai' });
    await noteCreate(db, { kind: 'atom', title: 'SQLite WAL Mode', content: 'WAL mode improves concurrent reads', tags: ['sqlite', 'perf'], source: 'human' });
    await noteCreate(db, { kind: 'atom', title: 'Drizzle ORM Setup', content: 'Drizzle provides type-safe SQL queries with TypeScript', tags: ['typescript', 'orm'], source: 'ai' });
    await noteCreate(db, { kind: 'atom', title: 'FTS5 Indexing', content: 'Full text search with FTS5 virtual tables', tags: ['sqlite', 'search'], source: 'ai' });
    await noteCreate(db, { kind: 'atom', title: 'Node Performance', content: 'Optimize Node.js performance with worker threads', tags: ['node', 'perf'], source: 'human' });
  });
  afterEach(() => close());

  it('finds document chunks by content match', async () => {
    await noteCreate(db, {
      kind: 'document',
      title: 'Testing Guide',
      content: '## Unit Testing\n\nUse Vitest for unit tests.\n\n## E2E Testing\n\nUse Playwright for end-to-end tests.',
      tags: ['testing'],
      source: 'ai',
    });
    // FTS5 implicit AND: "Vitest" is in one chunk, "Playwright" in another.
    // Search for a single term that lives in a chunk.
    const hits = await fulltextSearch(db, { query: 'Vitest', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some(h => h.ownerType === 'chunk')).toBe(true);
  });

  it('finds document chunks with OR query across chunks', async () => {
    await noteCreate(db, {
      kind: 'document',
      title: 'Testing Guide 2',
      content: '## Unit Testing\n\nUse Vitest for unit tests.\n\n## E2E Testing\n\nUse Playwright for end-to-end tests.',
      tags: ['testing'],
      source: 'ai',
    });
    const hits = await fulltextSearch(db, { query: 'Vitest OR Playwright', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('finds notes by title match', async () => {
    const hits = await fulltextSearch(db, { query: 'TypeScript', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some(h => h.snippet.toLowerCase().includes('typescript'))).toBe(true);
  });

  it('finds notes by content match', async () => {
    const hits = await fulltextSearch(db, { query: 'WAL concurrent', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('respects limit', async () => {
    const hits = await fulltextSearch(db, { query: 'mode OR search OR performance', limit: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it('filters by tags_any', async () => {
    const hits = await fulltextSearch(db, { query: 'mode OR search', limit: 10, tags_any: ['sqlite'] });
    expect(hits.every(h => {
      const note = db.prepare('SELECT tags FROM notes WHERE id = ?').get(h.ownerId) as any;
      const tags = JSON.parse(note.tags);
      return tags.some((t: string) => ['sqlite'].includes(t));
    })).toBe(true);
  });

  it('returns scored hits sorted by relevance', async () => {
    const hits = await fulltextSearch(db, { query: 'TypeScript', limit: 10 });
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
    }
  });
});
