import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { MESSAGE_TYPES, MESSAGE_PRIORITIES } from '@agent-brain/shared';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const MessageCreateInput = z.object({
  projectSlug: z.string().min(1).max(64),
  type: z.enum(MESSAGE_TYPES),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(1_000_000),
  priority: z.enum(MESSAGE_PRIORITIES).optional().default('normal'),
  metadata: z
    .object({
      severity: z.enum(['bug', 'regression', 'warning']).optional(),
      assignee: z.string().optional(),
      source: z.string().optional(),
      sourceProject: z.string().optional(),
      relatedNoteIds: z.array(z.string().uuid()).optional(),
    })
    .passthrough()
    .optional()
    .default({}),
});

// ---------------------------------------------------------------------------
// Helpers — map raw SQLite rows to camelCase (gotcha 3)
// ---------------------------------------------------------------------------

interface RawMessageRow {
  id: string;
  project_id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  content: string;
  metadata: string;
  created_at: number;
  updated_at: number;
}

function toMessage(row: RawMessageRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    priority: row.priority,
    title: row.title,
    content: row.content,
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveProjectSlug(db: Database, slug: string): string {
  const row = db
    .prepare('SELECT id FROM projects WHERE slug = ?')
    .get(slug) as { id: string } | undefined;
  if (!row) {
    throw new Error(`Project not found: slug="${slug}"`);
  }
  return row.id;
}

// ---------------------------------------------------------------------------
// messageCreate
// ---------------------------------------------------------------------------

export function messageCreate(db: Database, raw: unknown) {
  const input = MessageCreateInput.parse(raw);
  const projectId = resolveProjectSlug(db, input.projectSlug);
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO messages (id, project_id, type, status, priority, title, content, metadata, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    input.type,
    input.priority,
    input.title,
    input.content,
    JSON.stringify(input.metadata),
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as RawMessageRow;
  return { ok: true as const, id, item: toMessage(row) };
}
