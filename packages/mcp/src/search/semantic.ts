import type { Database } from 'better-sqlite3';
import { embedQuery } from '../embeddings/embed.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticHit {
  ownerType: 'note' | 'chunk';
  ownerId: string;
  score: number;
  snippet: string;
}

export interface SemanticSearchInput {
  query: string;
  limit?: number;
  projectId?: string;
  tags_any?: string[];
  tags_all?: string[];
  kind?: string;
  status?: string;
  source?: string;
}

// ---------------------------------------------------------------------------
// semanticSearch — cosine similarity over E5 embeddings with SQL pre-filtering
// ---------------------------------------------------------------------------

export async function semanticSearch(
  db: Database,
  input: SemanticSearchInput,
): Promise<SemanticHit[]> {
  const limit = input.limit ?? 20;

  // 1. Embed the query
  const queryVec = await embedQuery(input.query);

  // 2. Build SQL with filters applied BEFORE loading vectors
  const conditions: string[] = ["model = 'Xenova/multilingual-e5-base'"];
  const params: unknown[] = [];

  if (input.projectId) {
    conditions.push('project_id = ?');
    params.push(input.projectId);
  }

  if (input.kind) {
    conditions.push('kind = ?');
    params.push(input.kind);
  }

  if (input.status) {
    conditions.push('status = ?');
    params.push(input.status);
  }

  if (input.source) {
    conditions.push('source = ?');
    params.push(input.source);
  }

  if (input.tags_any && input.tags_any.length > 0) {
    const placeholders = input.tags_any.map(() => '?').join(', ');
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value IN (${placeholders}))`,
    );
    params.push(...input.tags_any);
  }

  if (input.tags_all && input.tags_all.length > 0) {
    const placeholders = input.tags_all.map(() => '?').join(', ');
    conditions.push(
      `(SELECT COUNT(DISTINCT json_each.value) FROM json_each(tags) WHERE json_each.value IN (${placeholders})) = ?`,
    );
    params.push(...input.tags_all, input.tags_all.length);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT owner_type, owner_id, vector
    FROM embedding_owners
    ${whereClause}
  `;

  interface RawRow {
    owner_type: string;
    owner_id: string;
    vector: Buffer;
  }

  const rows = db.prepare(sql).all(...params) as RawRow[];

  // 3. Compute cosine similarity (vectors are L2-normalized, dot = cosine)
  const dim = queryVec.length;
  const scored: { ownerType: 'note' | 'chunk'; ownerId: string; score: number }[] = [];

  for (const row of rows) {
    const vec = new Float32Array(new Uint8Array(row.vector).buffer);
    let dot = 0;
    for (let i = 0; i < dim; i++) {
      dot += queryVec[i]! * vec[i]!;
    }
    scored.push({
      ownerType: row.owner_type as 'note' | 'chunk',
      ownerId: row.owner_id,
      score: dot,
    });
  }

  // 4. Filter out non-positive scores, sort descending, take top N
  const positive = scored.filter((h) => h.score > 0);
  positive.sort((a, b) => b.score - a.score);
  const topHits = positive.slice(0, limit);

  // 5. Build snippets from content
  const results: SemanticHit[] = [];
  for (const hit of topHits) {
    const snippet = loadSnippet(db, hit.ownerType, hit.ownerId);
    results.push({ ...hit, snippet });
  }

  return results;
}

// ---------------------------------------------------------------------------
// loadSnippet — fetch content from the owner and truncate
// ---------------------------------------------------------------------------

function loadSnippet(db: Database, ownerType: 'note' | 'chunk', ownerId: string): string {
  const MAX_SNIPPET = 200;

  if (ownerType === 'note') {
    const row = db.prepare('SELECT content FROM notes WHERE id = ?').get(ownerId) as { content: string } | undefined;
    if (!row) return '';
    return row.content.length > MAX_SNIPPET
      ? row.content.slice(0, MAX_SNIPPET) + '...'
      : row.content;
  }

  // chunk
  const row = db.prepare('SELECT content FROM chunks WHERE id = ?').get(ownerId) as { content: string } | undefined;
  if (!row) return '';
  return row.content.length > MAX_SNIPPET
    ? row.content.slice(0, MAX_SNIPPET) + '...'
    : row.content;
}
