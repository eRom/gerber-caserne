import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { ISSUE_STATUSES, ISSUE_PRIORITIES, ISSUE_SEVERITIES } from '@agent-brain/shared';
import { resolveProjectSlug } from './_helpers.js';

// ---------------------------------------------------------------------------
// Helpers — map raw SQLite rows to camelCase (gotcha 3)
// ---------------------------------------------------------------------------

interface RawIssueRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  severity: string;
  assignee: string | null;
  tags: string;              // JSON string
  related_task_id: string | null;
  metadata: string;          // JSON string
  created_at: number;
  updated_at: number;
}

function toIssue(row: RawIssueRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    severity: row.severity,
    assignee: row.assignee,
    tags: JSON.parse(row.tags),
    relatedTaskId: row.related_task_id,
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const IssueCreateInput = z.object({
  projectSlug: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().max(1_000_000).optional().default(''),
  status: z.enum(ISSUE_STATUSES).optional().default('inbox'),
  severity: z.enum(ISSUE_SEVERITIES).optional().default('bug'),
  priority: z.enum(ISSUE_PRIORITIES).optional().default('normal'),
  assignee: z.string().max(100).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  metadata: z.object({
    source: z.string().optional(),
    reporter: z.string().optional(),
    relatedNoteIds: z.array(z.string().uuid()).optional(),
  }).passthrough().optional().default({}),
});

// ---------------------------------------------------------------------------
// issueCreate
// ---------------------------------------------------------------------------

export function issueCreate(db: Database, raw: unknown) {
  const input = IssueCreateInput.parse(raw);
  const projectId = resolveProjectSlug(db, input.projectSlug);
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO issues (
      id, project_id, title, description, status, priority, severity,
      assignee, tags, related_task_id, metadata,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    input.title,
    input.description,
    input.status,
    input.priority,
    input.severity,
    input.assignee ?? null,
    JSON.stringify(input.tags),
    null,
    JSON.stringify(input.metadata),
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as RawIssueRow;
  return { ok: true as const, id, item: toIssue(row) };
}

// ---------------------------------------------------------------------------
// issueList
// ---------------------------------------------------------------------------

const IssueListInput = z.object({
  projectSlug: z.string().min(1).max(64).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  severity: z.enum(ISSUE_SEVERITIES).optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  tags_any: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export function issueList(db: Database, raw: unknown) {
  const input = IssueListInput.parse(raw);

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
  if (input.severity) {
    clauses.push('severity = ?');
    params.push(input.severity);
  }
  if (input.priority) {
    clauses.push('priority = ?');
    params.push(input.priority);
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
    .prepare(`SELECT * FROM issues ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, input.limit, input.offset) as RawIssueRow[];

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM issues ${where}`).get(...params) as { c: number }
  ).c;

  return {
    items: rows.map(toIssue),
    total,
  };
}

// ---------------------------------------------------------------------------
// issueGet
// ---------------------------------------------------------------------------

const IssueGetInput = z.object({
  id: z.string().uuid(),
});

export function issueGet(db: Database, raw: unknown) {
  const input = IssueGetInput.parse(raw);
  const { id } = input;

  const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as RawIssueRow | undefined;
  if (!row) {
    throw new Error(`Issue not found: id="${id}"`);
  }

  return { item: toIssue(row) };
}

// ---------------------------------------------------------------------------
// issueUpdate
// ---------------------------------------------------------------------------

const IssueUpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1_000_000).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  severity: z.enum(ISSUE_SEVERITIES).optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  assignee: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  relatedTaskId: z.string().uuid().nullable().optional(),
  metadata: z.object({
    source: z.string().optional(),
    reporter: z.string().optional(),
    relatedNoteIds: z.array(z.string().uuid()).optional(),
  }).passthrough().optional(),
});

export function issueUpdate(db: Database, raw: unknown) {
  const input = IssueUpdateInput.parse(raw);
  const { id } = input;

  const existing = db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as RawIssueRow | undefined;
  if (!existing) {
    throw new Error(`Issue not found: id="${id}"`);
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
  }
  if (input.severity !== undefined) {
    setClauses.push('severity = ?');
    values.push(input.severity);
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
  if (input.relatedTaskId !== undefined) {
    setClauses.push('related_task_id = ?');
    values.push(input.relatedTaskId);
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
      `UPDATE issues SET ${setClauses.join(', ')} WHERE id = ?`,
    ).run(...values);
  }

  const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as RawIssueRow;
  return { ok: true as const, id, item: toIssue(row) };
}

// ---------------------------------------------------------------------------
// issueClose
// ---------------------------------------------------------------------------

const IssueCloseInput = z.object({
  id: z.string().uuid(),
});

export function issueClose(db: Database, raw: unknown) {
  const input = IssueCloseInput.parse(raw);
  const { id } = input;

  const existing = db.prepare('SELECT id FROM issues WHERE id = ?').get(id);
  if (!existing) {
    throw new Error(`Issue not found: id="${id}"`);
  }

  const now = Date.now();
  db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?').run('closed', now, id);

  const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as RawIssueRow;
  return { ok: true as const, id, item: toIssue(row) };
}
