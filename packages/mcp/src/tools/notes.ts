import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';
import { sha256 } from '../db/hash.js';
import { embedPassage } from '../embeddings/embed.js';
import { chunk } from '../embeddings/chunking.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const NoteGetInput = z.object({
  id: z.string().uuid(),
});

const NoteDeleteInput = z.object({
  id: z.string().uuid(),
});

const NoteListInput = z.object({
  projectId: z.string().uuid().optional(),
  kind: z.enum(['atom', 'document']).optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  tags_any: z.array(z.string()).optional(),
  tags_all: z.array(z.string()).optional(),
  sort: z.enum(['updated_at', 'created_at', 'title']).optional().default('updated_at'),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
}).refine(
  (d) => !(d.tags_any && d.tags_all),
  { message: 'tags_any and tags_all are mutually exclusive' },
);

const NoteCreateInput = z.object({
  kind: z.enum(['atom', 'document']),
  title: z.string().min(1).max(250),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  source: z.string().min(1),
  projectId: z.string().uuid().optional().default(GLOBAL_PROJECT_ID),
});

// ---------------------------------------------------------------------------
// Helpers — map raw SQLite rows to camelCase (gotcha 3)
// ---------------------------------------------------------------------------

interface RawNoteRow {
  id: string;
  project_id: string;
  kind: string;
  title: string;
  content: string;
  tags: string;
  status: string;
  source: string;
  content_hash: string;
  created_at: number;
  updated_at: number;
}

interface RawChunkRow {
  id: string;
  note_id: string;
  position: number;
  heading_path: string | null;
  content: string;
  content_hash: string;
  created_at: number;
}

function toChunk(row: RawChunkRow) {
  return {
    id: row.id,
    noteId: row.note_id,
    position: row.position,
    headingPath: row.heading_path,
    content: row.content,
    contentHash: row.content_hash,
    createdAt: row.created_at,
  };
}

function toNote(row: RawNoteRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
    status: row.status,
    source: row.source,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// noteCreate
// ---------------------------------------------------------------------------

export async function noteCreate(
  db: Database,
  raw: unknown,
) {
  const input = NoteCreateInput.parse(raw);

  if (input.kind === 'document') {
    const id = crypto.randomUUID();
    const now = Date.now();
    const contentHash = sha256(input.content);

    // Compute all chunk embeddings BEFORE the transaction (embedPassage is async)
    const chunkResults = await chunk(input.content);
    const chunkData = await Promise.all(
      chunkResults.map(async (c) => ({
        ...c,
        id: crypto.randomUUID(),
        vec: await embedPassage(c.content),
      })),
    );

    db.transaction(() => {
      db.prepare(
        `INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.projectId,
        input.kind,
        input.title,
        input.content,
        JSON.stringify(input.tags),
        'active',
        input.source,
        contentHash,
        now,
        now,
      );

      for (const c of chunkData) {
        db.prepare(
          `INSERT INTO chunks (id, note_id, position, heading_path, content, content_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(c.id, id, c.position, c.heading_path, c.content, c.content_hash, now);

        const vecBuffer = Buffer.from(c.vec.buffer, c.vec.byteOffset, c.vec.byteLength);
        db.prepare(
          `INSERT INTO embeddings (owner_type, owner_id, model, dim, vector, content_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run('chunk', c.id, 'Xenova/multilingual-e5-base', 768, vecBuffer, c.content_hash, now);
      }
    })();

    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNoteRow;
    return { ok: true as const, id, item: toNote(row) };
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const contentHash = sha256(input.content);

  // Compute embedding BEFORE the transaction (embedPassage is async, cannot await inside better-sqlite3 transaction)
  const vec = await embedPassage(input.content);

  const vectorBuffer = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.projectId,
      input.kind,
      input.title,
      input.content,
      JSON.stringify(input.tags),
      'active',
      input.source,
      contentHash,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO embeddings (owner_type, owner_id, model, dim, vector, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'note',
      id,
      'Xenova/multilingual-e5-base',
      768,
      vectorBuffer,
      contentHash,
      now,
    );
  })();

  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNoteRow;
  return { ok: true as const, id, item: toNote(row) };
}

// ---------------------------------------------------------------------------
// noteGet
// ---------------------------------------------------------------------------

export function noteGet(db: Database, raw: unknown) {
  const { id } = NoteGetInput.parse(raw);
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNoteRow | undefined;
  if (!row) throw new Error(`Note not found: ${id}`);

  const note = toNote(row);

  if (note.kind === 'document') {
    const chunkRows = db
      .prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position')
      .all(id) as RawChunkRow[];
    return { item: { ...note, chunks: chunkRows.map(toChunk) } };
  }

  return { item: note };
}

// ---------------------------------------------------------------------------
// noteDelete
// ---------------------------------------------------------------------------

export function noteDelete(db: Database, raw: unknown) {
  const { id } = NoteDeleteInput.parse(raw);
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return { ok: true as const, id };
}

// ---------------------------------------------------------------------------
// noteList
// ---------------------------------------------------------------------------

export function noteList(db: Database, raw: unknown) {
  const input = NoteListInput.parse(raw);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.projectId) {
    conditions.push('notes.project_id = ?');
    params.push(input.projectId);
  }

  if (input.kind) {
    conditions.push('notes.kind = ?');
    params.push(input.kind);
  }

  if (input.status) {
    conditions.push('notes.status = ?');
    params.push(input.status);
  }

  if (input.source) {
    conditions.push('notes.source = ?');
    params.push(input.source);
  }

  if (input.tags_any && input.tags_any.length > 0) {
    const placeholders = input.tags_any.map(() => '?').join(', ');
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(notes.tags) WHERE json_each.value IN (${placeholders}))`,
    );
    params.push(...input.tags_any);
  }

  if (input.tags_all && input.tags_all.length > 0) {
    const placeholders = input.tags_all.map(() => '?').join(', ');
    conditions.push(
      `(SELECT COUNT(DISTINCT json_each.value) FROM json_each(notes.tags) WHERE json_each.value IN (${placeholders})) = ?`,
    );
    params.push(...input.tags_all, input.tags_all.length);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = `ORDER BY notes.${input.sort} DESC`;

  // Total count
  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM notes ${whereClause}`)
    .get(...params) as { total: number };

  // Paginated results
  const rows = db
    .prepare(`SELECT * FROM notes ${whereClause} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, input.limit, input.offset) as RawNoteRow[];

  return {
    items: rows.map(toNote),
    total: countRow.total,
    limit: input.limit,
    offset: input.offset,
  };
}
