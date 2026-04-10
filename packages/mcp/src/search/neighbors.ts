import type { Database } from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NeighborChunk {
  position: number;
  content: string;
}

export interface HitWithNeighbors<T extends { ownerType: string; ownerId: string }> {
  neighbors?: NeighborChunk[];
}

// ---------------------------------------------------------------------------
// expandNeighbors — loads adjacent chunks for chunk hits
// ---------------------------------------------------------------------------

export function expandNeighbors<
  T extends { ownerType: 'note' | 'chunk'; ownerId: string; score: number; snippet: string },
>(db: Database, hits: T[], maxNeighbors = 1): (T & { neighbors?: NeighborChunk[] })[] {
  const chunkRow = db.prepare<[string], { note_id: string; position: number }>(
    'SELECT note_id, position FROM chunks WHERE id = ?',
  );

  const neighborRows = db.prepare<[string, number, number], { position: number; content: string }>(
    'SELECT position, content FROM chunks WHERE note_id = ? AND ABS(position - ?) BETWEEN 1 AND ? ORDER BY position',
  );

  return hits.map((hit) => {
    if (hit.ownerType !== 'chunk') return hit;

    const chunk = chunkRow.get(hit.ownerId);
    if (!chunk) return hit;

    const neighbors = neighborRows.all(chunk.note_id, chunk.position, maxNeighbors).map((n) => ({
      position: n.position,
      content: n.content.slice(0, 300),
    }));

    return { ...hit, neighbors };
  });
}
