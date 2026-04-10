import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';
import { sha256 } from '../db/hash.js';
import { embedPassage } from '../embeddings/embed.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

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
    throw new Error('document path not implemented — see Task 22');
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
