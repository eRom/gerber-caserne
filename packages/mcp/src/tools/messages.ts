import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { MESSAGE_TYPES, MESSAGE_STATUSES } from '@agent-brain/shared';
import { resolveProjectSlug } from './_helpers.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const MessageCreateInput = z.object({
  projectSlug: z.string().min(1).max(64),
  type: z.enum(MESSAGE_TYPES),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(1_000_000),
  metadata: z
    .object({
      source: z.string().optional(),
      sourceProject: z.string().optional(),
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
    title: row.title,
    content: row.content,
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    `INSERT INTO messages (id, project_id, type, status, title, content, metadata, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    input.type,
    input.title,
    input.content,
    JSON.stringify(input.metadata),
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as RawMessageRow;
  return { ok: true as const, id, item: toMessage(row) };
}

// ---------------------------------------------------------------------------
// messageUpdate
// ---------------------------------------------------------------------------

const MessageUpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  content: z.string().min(1).max(1_000_000).optional(),
  metadata: z
    .object({
      source: z.string().optional(),
      sourceProject: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export function messageUpdate(db: Database, raw: unknown) {
  const input = MessageUpdateInput.parse(raw);
  const { id } = input;

  const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as RawMessageRow | undefined;
  if (!existing) {
    throw new Error(`Message not found: id="${id}"`);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.status !== undefined) {
    setClauses.push('status = ?');
    values.push(input.status);
  }
  if (input.content !== undefined) {
    setClauses.push('content = ?');
    values.push(input.content);
  }
  if (input.metadata !== undefined) {
    const existingMeta = JSON.parse(existing.metadata);
    const merged = { ...existingMeta, ...input.metadata };
    setClauses.push('metadata = ?');
    values.push(JSON.stringify(merged));
  }

  if (setClauses.length > 0) {
    const now = Date.now();
    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(
      `UPDATE messages SET ${setClauses.join(', ')} WHERE id = ?`,
    ).run(...values);
  }

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as RawMessageRow;
  return { ok: true as const, id, item: toMessage(row) };
}

// ---------------------------------------------------------------------------
// messageList
// ---------------------------------------------------------------------------

const MessageListInput = z.object({
  projectSlug: z.string().min(1).max(64).optional(),
  type: z.enum(MESSAGE_TYPES).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  since: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export function messageList(db: Database, raw: unknown) {
  const input = MessageListInput.parse(raw);

  let projectId: string | undefined;
  if (input.projectSlug) {
    projectId = resolveProjectSlug(db, input.projectSlug);
  }

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (projectId) {
    clauses.push('project_id = ?');
    params.push(projectId);
  }
  if (input.type) {
    clauses.push('type = ?');
    params.push(input.type);
  }
  if (input.status) {
    clauses.push('status = ?');
    params.push(input.status);
  }
  if (input.since !== undefined) {
    clauses.push('created_at > ?');
    params.push(input.since);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(`SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, input.limit) as RawMessageRow[];

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM messages ${where}`).get(...params) as { c: number }
  ).c;

  let pendingWhere = "status = 'pending'";
  const pendingParams: unknown[] = [];
  if (projectId) {
    pendingWhere += ' AND project_id = ?';
    pendingParams.push(projectId);
  }
  const pendingCount = (
    db.prepare(`SELECT COUNT(*) as c FROM messages WHERE ${pendingWhere}`).get(...pendingParams) as { c: number }
  ).c;

  return {
    items: rows.map(toMessage),
    total,
    pendingCount,
  };
}
