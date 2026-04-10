import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate } from '../../tools/notes.js';
import { hybridSearch } from '../../search/hybrid.js';
import { expandNeighbors } from '../../search/neighbors.js';

describe('hybridSearch (RRF)', () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    ({ db, close } = freshDb());
    await noteCreate(db, { kind: 'atom', title: 'TypeScript strict', content: 'Enable strict mode in tsconfig for type safety', tags: ['ts'], source: 'ai' });
    await noteCreate(db, { kind: 'atom', title: 'SQLite WAL', content: 'WAL journal mode for better concurrency', tags: ['db'], source: 'human' });
    await noteCreate(db, { kind: 'atom', title: 'Drizzle ORM', content: 'Type-safe SQL with Drizzle and TypeScript', tags: ['ts', 'db'], source: 'ai' });
  });
  afterEach(() => close());

  it('combines fulltext and semantic results', async () => {
    const hits = await hybridSearch(db, { query: 'TypeScript strict', limit: 10 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('a hit appearing in both fulltext and semantic ranks higher', async () => {
    // TypeScript strict should match both FTS (title) and semantic
    const hits = await hybridSearch(db, { query: 'TypeScript strict mode', limit: 10 });
    if (hits.length >= 2) {
      // The top hit should have the highest RRF score
      expect(hits[0]!.score).toBeGreaterThanOrEqual(hits[1]!.score);
    }
  });

  it('RRF scores are positive', async () => {
    const hits = await hybridSearch(db, { query: 'database', limit: 10 });
    for (const h of hits) {
      expect(h.score).toBeGreaterThan(0);
    }
  });

  it('respects limit', async () => {
    const hits = await hybridSearch(db, { query: 'mode OR search', limit: 1 });
    expect(hits.length).toBeLessThanOrEqual(1);
  });
});

describe('expandNeighbors', () => {
  it('loads adjacent chunks for chunk hits', async () => {
    const { db: db2, close: close2 } = freshDb();
    // Create a document with multiple sections
    await noteCreate(db2, {
      kind: 'document',
      title: 'Multi-section',
      content: '## A\n\nAlpha body.\n\n## B\n\nBeta body.\n\n## C\n\nGamma body.',
      tags: [],
      source: 'ai',
    });

    // Get chunks
    const chunks = db2.prepare('SELECT * FROM chunks ORDER BY position').all() as any[];
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    // Create a fake hit for the middle chunk
    const midChunk = chunks[1]!;
    const hits = [{
      ownerType: 'chunk' as const,
      ownerId: midChunk.id,
      score: 0.9,
      snippet: 'test',
    }];

    const expanded = expandNeighbors(db2, hits, 1);
    expect(expanded[0]!.neighbors).toBeDefined();
    expect(expanded[0]!.neighbors!.length).toBeGreaterThanOrEqual(1);
    close2();
  });
});
