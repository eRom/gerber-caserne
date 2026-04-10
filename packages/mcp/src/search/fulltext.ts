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

  // FTS5 stores source_type ('note'|'chunk') and source_id (UUID) alongside
  // the indexed title/content. We query FTS5 first, then resolve metadata from
  // the parent note for filter-before-ranking.
  //
  // Strategy: query FTS5 without filters (fast), then resolve the parent note
  // for each hit and apply filters in JS. This is acceptable because FTS5
  // already limits the result set via MATCH + LIMIT.

  const ftsParams: unknown[] = [input.query, limit * 3]; // overfetch to compensate for post-filter

  // JOIN fts_source to resolve the source type and UUID for each FTS5 hit.
  // fts_source is populated by triggers alongside the FTS5 inserts.
  const ftsSql = `
    SELECT
      fs.source_type,
      fs.source_id,
      bm25(notes_fts) AS score
    FROM notes_fts
    JOIN fts_source fs ON fs.fts_rowid = notes_fts.rowid
    WHERE notes_fts MATCH ?
    ORDER BY bm25(notes_fts) ASC
    LIMIT ?
  `;

  interface FtsRow {
    source_type: string;
    source_id: string;
    score: number;
  }

  const ftsRows = db.prepare(ftsSql).all(...ftsParams) as FtsRow[];

  // Resolve parent note metadata for each hit and apply filters
  const results: { ownerId: string; ownerType: 'note' | 'chunk'; score: number; title: string; content: string }[] = [];

  for (const row of ftsRows) {
    let noteRow: { id: string; project_id: string; kind: string; status: string; source: string; tags: string; title: string; content: string } | undefined;
    let hitTitle: string;
    let hitContent: string;

    if (row.source_type === 'note') {
      noteRow = db.prepare('SELECT id, project_id, kind, status, source, tags, title, content FROM notes WHERE id = ?').get(row.source_id) as typeof noteRow;
      if (!noteRow) continue;
      hitTitle = noteRow.title;
      hitContent = noteRow.content;
    } else {
      // chunk → resolve parent note
      const chunk = db.prepare('SELECT note_id, heading_path, content FROM chunks WHERE id = ?').get(row.source_id) as { note_id: string; heading_path: string; content: string } | undefined;
      if (!chunk) continue;
      noteRow = db.prepare('SELECT id, project_id, kind, status, source, tags, title, content FROM notes WHERE id = ?').get(chunk.note_id) as typeof noteRow;
      if (!noteRow) continue;
      hitTitle = chunk.heading_path ?? noteRow.title;
      hitContent = chunk.content;
    }

    // Apply filters on the parent note
    if (input.projectId && noteRow.project_id !== input.projectId) continue;
    if (input.kind && noteRow.kind !== input.kind) continue;
    if (input.status && noteRow.status !== input.status) continue;
    if (input.source && noteRow.source !== input.source) continue;

    if (input.tags_any && input.tags_any.length > 0) {
      const tags: string[] = JSON.parse(noteRow.tags);
      if (!input.tags_any.some(t => tags.includes(t))) continue;
    }

    if (input.tags_all && input.tags_all.length > 0) {
      const tags: string[] = JSON.parse(noteRow.tags);
      if (!input.tags_all.every(t => tags.includes(t))) continue;
    }

    results.push({
      ownerId: row.source_id,
      ownerType: row.source_type as 'note' | 'chunk',
      score: -row.score,
      title: hitTitle,
      content: hitContent,
    });

    if (results.length >= limit) break;
  }

  return results.map((r) => ({
    ownerType: r.ownerType,
    ownerId: r.ownerId,
    score: r.score,
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
