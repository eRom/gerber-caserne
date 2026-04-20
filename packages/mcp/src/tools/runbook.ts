import { join, isAbsolute } from 'node:path';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { spawnDetached, isAlive, killPid } from '../runbook/process.js';
import { logPathForSlug } from '../runbook/logs.js';

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

const RunInput = z.object({ project_id: z.string().uuid() });

interface RawProjectForRun {
  slug: string;
  repo_path: string | null;
  run_cmd: string | null;
  run_cwd: string | null;
  env_json: string | null;
  url: string | null;
}

export function projectRun(
  db: Database,
  raw: unknown,
): { ok: true; pid: number; log_path: string; url: string | null } {
  const { project_id } = RunInput.parse(raw);

  const existing = db
    .prepare('SELECT pid FROM running_processes WHERE project_id = ?')
    .get(project_id) as { pid: number } | undefined;
  if (existing) {
    if (isAlive(existing.pid)) {
      throw new Error(`already_running (pid ${existing.pid})`);
    }
    db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(project_id);
  }

  const project = db
    .prepare('SELECT slug, repo_path, run_cmd, run_cwd, env_json, url FROM projects WHERE id = ?')
    .get(project_id) as RawProjectForRun | undefined;
  if (!project) throw new Error(`Project ${project_id} not found`);
  if (!project.run_cmd) throw new Error('no_runbook: run_cmd is empty');
  if (!project.repo_path) throw new Error('no_repo_path: project.repo_path is null');

  const cwd = project.run_cwd
    ? isAbsolute(project.run_cwd)
      ? project.run_cwd
      : join(project.repo_path, project.run_cwd)
    : project.repo_path;

  const env = project.env_json ? (JSON.parse(project.env_json) as Record<string, string>) : {};
  const logPath = logPathForSlug(project.slug);

  const pid = spawnDetached({ cmd: project.run_cmd, cwd, env, logPath });
  const now = Date.now();

  db.prepare(
    `INSERT INTO running_processes (project_id, pid, started_at, log_path, run_cmd)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(project_id, pid, now, logPath, project.run_cmd);

  return { ok: true, pid, log_path: logPath, url: project.url };
}

const StopInput = z.object({
  project_id: z.string().uuid(),
  force: z.boolean().optional(),
});

export function projectStop(db: Database, raw: unknown): { ok: true } {
  const { project_id, force } = StopInput.parse(raw);
  const row = db
    .prepare('SELECT pid FROM running_processes WHERE project_id = ?')
    .get(project_id) as { pid: number } | undefined;
  if (!row) throw new Error('not_running');

  killPid(row.pid, force);
  db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(project_id);
  return { ok: true };
}

import { existsSync, readFileSync } from 'node:fs';

const TailInput = z.object({
  project_id: z.string().uuid(),
  lines: z.number().int().min(1).max(1000).optional().default(100),
});

export function projectTailLogs(
  db: Database,
  raw: unknown,
): { lines: string[]; path: string | null } {
  const { project_id, lines } = TailInput.parse(raw);

  const row = db
    .prepare('SELECT slug FROM projects WHERE id = ?')
    .get(project_id) as { slug: string } | undefined;
  if (!row) throw new Error(`Project ${project_id} not found`);

  const path = logPathForSlug(row.slug);
  if (!existsSync(path)) return { lines: [], path: null };

  const content = readFileSync(path, 'utf-8');
  const all = content.split('\n');
  const nonEmpty = all.length > 0 && all[all.length - 1] === '' ? all.slice(0, -1) : all;
  return { lines: nonEmpty.slice(-lines), path };
}

export function cleanupStaleProcesses(db: Database): number {
  const rows = db
    .prepare('SELECT project_id, pid FROM running_processes')
    .all() as Array<{ project_id: string; pid: number }>;
  let cleaned = 0;
  for (const row of rows) {
    if (!isAlive(row.pid)) {
      db.prepare('DELETE FROM running_processes WHERE project_id = ?').run(row.project_id);
      cleaned++;
    }
  }
  return cleaned;
}
