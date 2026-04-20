import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';
import { isAlive } from '../runbook/process.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ProjectCreateInput = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  repoPath: z.string().optional(),
  color: z.string().optional(),
});

const ProjectListInput = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

const ProjectUpdateInput = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  repoPath: z.string().optional(),
  color: z.string().optional(),
});

const ProjectDeleteInput = z.object({
  id: z.string().uuid().refine(
    (id) => id !== GLOBAL_PROJECT_ID,
    { message: 'Cannot delete the global project' },
  ),
});

// ---------------------------------------------------------------------------
// Helpers — map raw SQLite rows to camelCase (gotcha 3)
// ---------------------------------------------------------------------------

interface RawProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  repo_path: string | null;
  color: string | null;
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env_json: string | null;
  created_at: number;
  updated_at: number;
}

function toProject(row: RawProjectRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    repoPath: row.repo_path,
    color: row.color,
    runCmd: row.run_cmd,
    runCwd: row.run_cwd,
    url: row.url,
    env: row.env_json ? (JSON.parse(row.env_json) as Record<string, string>) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// projectCreate
// ---------------------------------------------------------------------------

export function projectCreate(
  db: Database,
  raw: unknown,
) {
  const input = ProjectCreateInput.parse(raw);
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO projects (id, slug, name, description, repo_path, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.slug,
    input.name,
    input.description ?? null,
    input.repoPath ?? null,
    input.color ?? null,
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as RawProjectRow;
  return { ok: true, id, item: { ...toProject(row), isRunning: false } };
}

// ---------------------------------------------------------------------------
// projectList
// ---------------------------------------------------------------------------

export function projectList(
  db: Database,
  raw: unknown,
) {
  const input = ProjectListInput.parse(raw);
  const { limit, offset } = input;

  const rows = db
    .prepare(
      `SELECT p.*, rp.pid AS rp_pid
         FROM projects p
         LEFT JOIN running_processes rp ON rp.project_id = p.id
         ORDER BY p.created_at ASC
         LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<RawProjectRow & { rp_pid: number | null }>;

  const items = rows.map((row) => {
    let isRunning = row.rp_pid !== null;
    if (isRunning && !isAlive(row.rp_pid!)) {
      db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(row.id);
      isRunning = false;
    }
    return { ...toProject(row), isRunning };
  });

  const total = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c;
  return { items, total, limit, offset };
}

// ---------------------------------------------------------------------------
// projectUpdate
// ---------------------------------------------------------------------------

export function projectUpdate(
  db: Database,
  raw: unknown,
) {
  const input = ProjectUpdateInput.parse(raw);
  const { id, ...fields } = input;

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (fields.slug !== undefined) {
    setClauses.push('slug = ?');
    values.push(fields.slug);
  }
  if (fields.name !== undefined) {
    setClauses.push('name = ?');
    values.push(fields.name);
  }
  if (fields.description !== undefined) {
    setClauses.push('description = ?');
    values.push(fields.description);
  }
  if (fields.repoPath !== undefined) {
    setClauses.push('repo_path = ?');
    values.push(fields.repoPath);
  }
  if (fields.color !== undefined) {
    setClauses.push('color = ?');
    values.push(fields.color);
  }

  if (setClauses.length > 0) {
    const now = Date.now();
    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`,
    ).run(...values);
  }

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as RawProjectRow;
  const running = db
    .prepare('SELECT pid FROM running_processes WHERE project_id = ?')
    .get(id) as { pid: number } | undefined;
  const isRunning = !!running && isAlive(running.pid);
  return { ok: true, id, item: { ...toProject(row), isRunning } };
}

// ---------------------------------------------------------------------------
// projectDelete
// ---------------------------------------------------------------------------

export function projectDelete(
  db: Database,
  raw: unknown,
): { ok: true; id: string; reassigned_count: number } {
  const input = ProjectDeleteInput.parse(raw);
  const { id } = input;

  const reassigned_count = db.transaction(() => {
    const { changes } = db
      .prepare('UPDATE notes SET project_id = ? WHERE project_id = ?')
      .run(GLOBAL_PROJECT_ID, id);

    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    return changes;
  })();

  return { ok: true, id, reassigned_count: reassigned_count as number };
}
