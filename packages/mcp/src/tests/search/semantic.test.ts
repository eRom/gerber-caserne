import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate } from '../../tools/notes.js';
import { semanticSearch } from '../../search/semantic.js';

describe('semanticSearch', () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = freshDb());
    await noteCreate(db, { kind: 'atom', title: 'TypeScript tips', content: 'Use strict mode and noUncheckedIndexedAccess', tags: ['ts'], source: 'ai' });
    await noteCreate(db, { kind: 'atom', title: 'SQLite optimization', content: 'WAL mode and busy_timeout for concurrency', tags: ['db'], source: 'human' });
    await noteCreate(db, { kind: 'atom', title: 'Drizzle migrations', content: 'Auto-generate migrations from schema', tags: ['ts', 'db'], source: 'ai' });
  });
  afterEach(() => close());

  it('returns scored hits sorted by relevance', async () => {
    const hits = await semanticSearch(db, { query: 'TypeScript configuration', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    // Sorted desc by score
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
    }
  });

  it('respects limit', async () => {
    const hits = await semanticSearch(db, { query: 'database', limit: 1 });
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it('filters by tags_any', async () => {
    const hits = await semanticSearch(db, { query: 'migrations', limit: 10, tags_any: ['db'] });
    for (const hit of hits) {
      const note = db.prepare('SELECT tags FROM notes WHERE id = ?').get(hit.ownerId) as any;
      if (note) {
        const tags: string[] = JSON.parse(note.tags);
        expect(tags.some(t => t === 'db')).toBe(true);
      }
    }
  });

  it('returns hits with ownerType and ownerId', async () => {
    const hits = await semanticSearch(db, { query: 'strict mode', limit: 10 });
    for (const hit of hits) {
      expect(hit.ownerType).toBeDefined();
      expect(hit.ownerId).toBeDefined();
      expect(hit.score).toBeGreaterThan(0);
    }
  });
});
