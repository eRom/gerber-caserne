import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { TASK_STATUSES, TASK_PRIORITIES } from '@agent-brain/shared';
import { resolveProjectSlug } from './_helpers.js';

// ---------------------------------------------------------------------------
// Helpers — map raw SQLite rows to camelCase (gotcha 3)
// ---------------------------------------------------------------------------

interface RawTaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  position: number;
  assignee: string | null;
  tags: string;          // JSON string
  due_date: number | null;
  waiting_on: string | null;
  completed_at: number | null;
  parent_id: string | null;
  metadata: string;      // JSON string
  created_at: number;
  updated_at: number;
}

function toTask(row: RawTaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    position: row.position,
    assignee: row.assignee,
    tags: JSON.parse(row.tags),
    dueDate: row.due_date,
    waitingOn: row.waiting_on,
    completedAt: row.completed_at,
    parentId: row.parent_id,
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const TaskCreateInput = z.object({
  projectSlug: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().max(1_000_000).optional().default(''),
  status: z.enum(TASK_STATUSES).optional().default('active'),
  priority: z.enum(TASK_PRIORITIES).optional().default('normal'),
  assignee: z.string().max(100).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  dueDate: z.number().int().nonnegative().optional(),
  waitingOn: z.string().max(200).optional(),
  parentId: z.string().uuid().optional(),
  metadata: z.object({
    source: z.string().optional(),
    relatedNoteIds: z.array(z.string().uuid()).optional(),
  }).passthrough().optional().default({}),
});

// ---------------------------------------------------------------------------
// taskCreate
// ---------------------------------------------------------------------------

export function taskCreate(db: Database, raw: unknown) {
  const input = TaskCreateInput.parse(raw);
  const projectId = resolveProjectSlug(db, input.projectSlug);
  const id = crypto.randomUUID();
  const now = Date.now();

  // Auto-calculate position based on parent
  let position: number;
  if (input.parentId) {
    const posRow = db.prepare(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM tasks WHERE project_id = ? AND status = ? AND parent_id = ?',
    ).get(projectId, input.status, input.parentId) as { pos: number };
    position = posRow.pos;
  } else {
    const posRow = db.prepare(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM tasks WHERE project_id = ? AND status = ? AND parent_id IS NULL',
    ).get(projectId, input.status) as { pos: number };
    position = posRow.pos;
  }

  const completedAt = input.status === 'done' ? now : null;

  db.prepare(
    `INSERT INTO tasks (
      id, project_id, title, description, status, priority, position,
      assignee, tags, due_date, waiting_on, completed_at, parent_id, metadata,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    input.title,
    input.description,
    input.status,
    input.priority,
    position,
    input.assignee ?? null,
    JSON.stringify(input.tags),
    input.dueDate ?? null,
    input.waitingOn ?? null,
    completedAt,
    input.parentId ?? null,
    JSON.stringify(input.metadata),
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTaskRow;
  return { ok: true as const, id, item: toTask(row) };
}

// ---------------------------------------------------------------------------
// taskList
// ---------------------------------------------------------------------------

const TaskListInput = z.object({
  projectSlug: z.string().min(1).max(64).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  tags_any: z.array(z.string()).optional(),
  parentId: z.string().uuid().optional(),
  sort: z.enum(['position', 'created_at', 'updated_at', 'due_date']).optional().default('position'),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export function taskList(db: Database, raw: unknown) {
  const input = TaskListInput.parse(raw);

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
  if (input.status) {
    clauses.push('status = ?');
    params.push(input.status);
  }
  if (input.priority) {
    clauses.push('priority = ?');
    params.push(input.priority);
  }
  if (input.parentId !== undefined) {
    clauses.push('parent_id = ?');
    params.push(input.parentId);
  } else {
    // Only return top-level tasks by default
    clauses.push('parent_id IS NULL');
  }
  if (input.tags_any && input.tags_any.length > 0) {
    const placeholders = input.tags_any.map(() => '?').join(', ');
    clauses.push(
      `EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value IN (${placeholders}))`,
    );
    params.push(...input.tags_any);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY ${input.sort} ASC LIMIT ? OFFSET ?`)
    .all(...params, input.limit, input.offset) as RawTaskRow[];

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM tasks ${where}`).get(...params) as { c: number }
  ).c;

  return {
    items: rows.map(toTask),
    total,
  };
}

// ---------------------------------------------------------------------------
// taskGet
// ---------------------------------------------------------------------------

const TaskGetInput = z.object({
  id: z.string().uuid(),
});

export function taskGet(db: Database, raw: unknown) {
  const input = TaskGetInput.parse(raw);
  const { id } = input;

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTaskRow | undefined;
  if (!row) {
    throw new Error(`Task not found: id="${id}"`);
  }

  const subtaskRows = db
    .prepare('SELECT * FROM tasks WHERE parent_id = ? ORDER BY position ASC')
    .all(id) as RawTaskRow[];

  return {
    item: toTask(row),
    subtasks: subtaskRows.map(toTask),
  };
}

// ---------------------------------------------------------------------------
// taskUpdate
// ---------------------------------------------------------------------------

const TaskUpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1_000_000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignee: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  dueDate: z.number().int().nonnegative().nullable().optional(),
  waitingOn: z.string().max(200).nullable().optional(),
  metadata: z.object({
    source: z.string().optional(),
    relatedNoteIds: z.array(z.string().uuid()).optional(),
  }).passthrough().optional(),
});

export function taskUpdate(db: Database, raw: unknown) {
  const input = TaskUpdateInput.parse(raw);
  const { id } = input;

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTaskRow | undefined;
  if (!existing) {
    throw new Error(`Task not found: id="${id}"`);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    setClauses.push('title = ?');
    values.push(input.title);
  }
  if (input.description !== undefined) {
    setClauses.push('description = ?');
    values.push(input.description);
  }
  if (input.status !== undefined) {
    setClauses.push('status = ?');
    values.push(input.status);
    // Handle completedAt
    if (input.status === 'done') {
      setClauses.push('completed_at = ?');
      values.push(Date.now());
    } else {
      setClauses.push('completed_at = NULL');
    }
  }
  if (input.priority !== undefined) {
    setClauses.push('priority = ?');
    values.push(input.priority);
  }
  if (input.assignee !== undefined) {
    setClauses.push('assignee = ?');
    values.push(input.assignee);
  }
  if (input.tags !== undefined) {
    setClauses.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }
  if (input.dueDate !== undefined) {
    setClauses.push('due_date = ?');
    values.push(input.dueDate);
  }
  if (input.waitingOn !== undefined) {
    setClauses.push('waiting_on = ?');
    values.push(input.waitingOn);
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
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`,
    ).run(...values);
  }

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTaskRow;
  return { ok: true as const, id, item: toTask(row) };
}

// ---------------------------------------------------------------------------
// taskDelete
// ---------------------------------------------------------------------------

const TaskDeleteInput = z.object({
  id: z.string().uuid(),
});

export function taskDelete(db: Database, raw: unknown) {
  const input = TaskDeleteInput.parse(raw);
  const { id } = input;

  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!existing) {
    throw new Error(`Task not found: id="${id}"`);
  }

  const subtaskCount = (
    db.prepare('SELECT COUNT(*) as c FROM tasks WHERE parent_id = ?').get(id) as { c: number }
  ).c;

  db.prepare('DELETE FROM tasks WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

  return { ok: true as const, id, deletedCount: 1 + subtaskCount };
}

// ---------------------------------------------------------------------------
// taskReorder
// ---------------------------------------------------------------------------

const TaskReorderInput = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export function taskReorder(db: Database, raw: unknown) {
  const input = TaskReorderInput.parse(raw);
  const now = Date.now();

  const stmt = db.prepare('UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?');
  for (let i = 0; i < input.ids.length; i++) {
    stmt.run(i, now, input.ids[i]);
  }

  return { ok: true as const };
}
