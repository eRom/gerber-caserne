import type { Database } from 'better-sqlite3';
import { z } from 'zod';

const EnvSchema = z.record(
  z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'env keys must match [A-Z_][A-Z0-9_]*'),
  z.string(),
);

const GetInput = z.object({
  project_id: z.string().uuid(),
});

const SetInput = z.object({
  project_id: z.string().uuid(),
  run_cmd: z.string().trim().max(2000).nullable().optional(),
  run_cwd: z
    .string()
    .trim()
    .max(260)
    .refine((s) => !s.startsWith('/') && !s.split('/').includes('..'), {
      message: 'run_cwd must be relative and must not contain ..',
    })
    .nullable()
    .optional(),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (s) => /^https?:\/\//.test(s),
      'url must be http(s)://',
    )
    .nullable()
    .optional(),
  env: EnvSchema.nullable().optional(),
});

interface RawProjectRow {
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env_json: string | null;
}

interface RawRunningRow {
  pid: number;
  started_at: number;
  log_path: string;
}

export interface RunbookResult {
  run_cmd: string | null;
  run_cwd: string | null;
  url: string | null;
  env: Record<string, string> | null;
  is_running: boolean;
  pid?: number;
  started_at?: number;
  log_path?: string;
}

export function projectGetRunbook(db: Database, raw: unknown): RunbookResult {
  const { project_id } = GetInput.parse(raw);
  const row = db
    .prepare('SELECT run_cmd, run_cwd, url, env_json FROM projects WHERE id = ?')
    .get(project_id) as RawProjectRow | undefined;
  if (!row) throw new Error(`Project ${project_id} not found`);

  const running = db
    .prepare('SELECT pid, started_at, log_path FROM running_processes WHERE project_id = ?')
    .get(project_id) as RawRunningRow | undefined;

  return {
    run_cmd: row.run_cmd,
    run_cwd: row.run_cwd,
    url: row.url,
    env: row.env_json ? (JSON.parse(row.env_json) as Record<string, string>) : null,
    is_running: !!running,
    ...(running ? { pid: running.pid, started_at: running.started_at, log_path: running.log_path } : {}),
  };
}

export function projectSetRunbook(
  db: Database,
  raw: unknown,
): { ok: true; project_id: string } {
  const input = SetInput.parse(raw);
  const { project_id, ...fields } = input;

  const sets: string[] = [];
  const values: unknown[] = [];

  if ('run_cmd' in fields) {
    sets.push('run_cmd = ?');
    values.push(fields.run_cmd ?? null);
  }
  if ('run_cwd' in fields) {
    sets.push('run_cwd = ?');
    values.push(fields.run_cwd ?? null);
  }
  if ('url' in fields) {
    sets.push('url = ?');
    values.push(fields.url ?? null);
  }
  if ('env' in fields) {
    sets.push('env_json = ?');
    values.push(fields.env ? JSON.stringify(fields.env) : null);
  }

  if (sets.length === 0) return { ok: true, project_id };

  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(project_id);

  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return { ok: true, project_id };
}
