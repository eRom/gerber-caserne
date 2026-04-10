import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

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
): { ok: true; id: string; item: ProjectRow } {
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
  return { ok: true, id, item: toProject(row) };
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
    .prepare('SELECT * FROM projects ORDER BY created_at ASC LIMIT ? OFFSET ?')
    .all(limit, offset) as RawProjectRow[];

  const total = (
    db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }
  ).c;

  return { items: rows.map(toProject), total, limit, offset };
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
  return { ok: true, id, item: toProject(row) };
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
