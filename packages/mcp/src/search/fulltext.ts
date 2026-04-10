import type { Database } from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FulltextHit {
  ownerType: 'note' | 'chunk';
  ownerId: string;
  score: number;
  snippet: string;
}

export interface FulltextSearchInput {
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
// fulltextSearch — FTS5 with BM25 scoring and optional filters
// ---------------------------------------------------------------------------

export async function fulltextSearch(
  db: Database,
  input: FulltextSearchInput,
): Promise<FulltextHit[]> {
  const limit = input.limit ?? 20;

  // Build dynamic WHERE conditions (applied on the joined notes table)
  const conditions: string[] = ['notes_fts MATCH ?'];
  const params: unknown[] = [input.query];

  if (input.projectId) {
    conditions.push('n.project_id = ?');
    params.push(input.projectId);
  }

  if (input.kind) {
    conditions.push('n.kind = ?');
    params.push(input.kind);
  }

  if (input.status) {
    conditions.push('n.status = ?');
    params.push(input.status);
  }

  if (input.source) {
    conditions.push('n.source = ?');
    params.push(input.source);
  }

  if (input.tags_any && input.tags_any.length > 0) {
    const placeholders = input.tags_any.map(() => '?').join(', ');
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(n.tags) WHERE json_each.value IN (${placeholders}))`,
    );
    params.push(...input.tags_any);
  }

  if (input.tags_all && input.tags_all.length > 0) {
    const placeholders = input.tags_all.map(() => '?').join(', ');
    conditions.push(
      `(SELECT COUNT(DISTINCT json_each.value) FROM json_each(n.tags) WHERE json_each.value IN (${placeholders})) = ?`,
    );
    params.push(...input.tags_all, input.tags_all.length);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // bm25() returns negative scores (more negative = more relevant), sort ASC
  // Note: snippet()/highlight() don't work with contentless FTS (content=''),
  // so we build snippets from the joined notes table instead.
  const sql = `
    SELECT
      n.id AS owner_id,
      'note' AS owner_type,
      bm25(notes_fts) AS score,
      n.title AS title,
      n.content AS content
    FROM notes_fts
    JOIN notes n ON n.rowid = notes_fts.rowid
    ${whereClause}
    ORDER BY bm25(notes_fts) ASC
    LIMIT ?
  `;

  params.push(limit);

  interface RawRow {
    owner_id: string;
    owner_type: string;
    score: number;
    title: string;
    content: string;
  }

  const rows = db.prepare(sql).all(...params) as RawRow[];

  return rows.map((r) => ({
    ownerType: r.owner_type as 'note' | 'chunk',
    ownerId: r.owner_id,
    score: -r.score, // negate so higher = better
    snippet: buildSnippet(r.title, r.content, input.query),
  }));
}

// ---------------------------------------------------------------------------
// buildSnippet — extract a short context window around the first query term
// ---------------------------------------------------------------------------

function buildSnippet(title: string, content: string, query: string): string {
  // Extract individual terms from the FTS query (strip OR/AND/NOT operators)
  const terms = query
    .split(/\s+/)
    .filter((t) => !['OR', 'AND', 'NOT'].includes(t.toUpperCase()))
    .map((t) => t.replace(/['"*]/g, ''));

  // Try to find a term in content first, then title
  for (const text of [content, title]) {
    for (const term of terms) {
      const idx = text.toLowerCase().indexOf(term.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(text.length, idx + term.length + 80);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < text.length ? '...' : '';
        return `${prefix}${text.slice(start, end)}${suffix}`;
      }
    }
  }

  // Fallback: first 120 chars of content
  return content.length > 120 ? `${content.slice(0, 120)}...` : content;
}
