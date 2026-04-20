import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { writeFileSync, rmSync } from 'node:fs';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { projectGetRunbook, projectSetRunbook, projectRun, projectStop, projectTailLogs } from '../../tools/runbook.js';
import { isAlive } from '../../runbook/process.js';
import { logPathForSlug } from '../../runbook/logs.js';

describe('runbook CRUD', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'demo', name: 'Demo', repoPath: '/tmp/demo' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('get returns nulls for a fresh project', () => {
    const rb = projectGetRunbook(db, { project_id: projectId });
    expect(rb.run_cmd).toBeNull();
    expect(rb.run_cwd).toBeNull();
    expect(rb.url).toBeNull();
    expect(rb.env).toBeNull();
    expect(rb.is_running).toBe(false);
  });

  it('set persists the runbook', () => {
    projectSetRunbook(db, {
      project_id: projectId,
      run_cmd: 'pnpm dev',
      url: 'http://localhost:5173',
      env: { PORT: '5173' },
    });
    const rb = projectGetRunbook(db, { project_id: projectId });
    expect(rb.run_cmd).toBe('pnpm dev');
    expect(rb.url).toBe('http://localhost:5173');
    expect(rb.env).toEqual({ PORT: '5173' });
  });

  it('set with null clears a field', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'pnpm dev' });
    projectSetRunbook(db, { project_id: projectId, run_cmd: null });
    const rb = projectGetRunbook(db, { project_id: projectId });
    expect(rb.run_cmd).toBeNull();
  });

  it('rejects relative path with traversal', () => {
    expect(() =>
      projectSetRunbook(db, { project_id: projectId, run_cwd: '../etc' }),
    ).toThrow();
  });

  it('rejects run_cmd over 2000 chars', () => {
    expect(() =>
      projectSetRunbook(db, { project_id: projectId, run_cmd: 'x'.repeat(2001) }),
    ).toThrow();
  });

  it('rejects invalid env keys', () => {
    expect(() =>
      projectSetRunbook(db, { project_id: projectId, env: { 'bad-key': '1' } }),
    ).toThrow();
  });
});

describe('project_run', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'runme', name: 'Run me', repoPath: '/tmp' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('fails when no runbook', () => {
    expect(() => projectRun(db, { project_id: projectId })).toThrow(/no_runbook/);
  });

  it('fails when no repo_path', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 1' });
    db.prepare('UPDATE projects SET repo_path = NULL WHERE id = ?').run(projectId);
    expect(() => projectRun(db, { project_id: projectId })).toThrow(/no_repo_path/);
  });

  it('starts a process, inserts running_processes row', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 5' });
    const res = projectRun(db, { project_id: projectId });
    expect(res.ok).toBe(true);
    expect(typeof res.pid).toBe('number');
    const row = db.prepare('SELECT * FROM running_processes WHERE project_id = ?').get(projectId);
    expect(row).toBeDefined();
    try { process.kill(res.pid, 'SIGTERM'); } catch {}
  });

  it('fails with already_running when called twice', () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 5' });
    const res = projectRun(db, { project_id: projectId });
    expect(() => projectRun(db, { project_id: projectId })).toThrow(/already_running/);
    try { process.kill(res.pid, 'SIGTERM'); } catch {}
  });
});

describe('project_stop', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'stopme', name: 'Stop me', repoPath: '/tmp' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('fails with not_running when nothing is running', () => {
    expect(() => projectStop(db, { project_id: projectId })).toThrow(/not_running/);
  });

  it('kills the process and removes the row', async () => {
    projectSetRunbook(db, { project_id: projectId, run_cmd: 'sleep 10' });
    const { pid } = projectRun(db, { project_id: projectId });
    const res = projectStop(db, { project_id: projectId });
    expect(res.ok).toBe(true);
    const row = db.prepare('SELECT * FROM running_processes WHERE project_id = ?').get(projectId);
    expect(row).toBeUndefined();
    await new Promise((r) => setTimeout(r, 200));
    expect(isAlive(pid)).toBe(false);
  });
});

describe('project_tail_logs', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const p = projectCreate(db, { slug: 'logtest', name: 'Log', repoPath: '/tmp' });
    projectId = p.id;
  });
  afterEach(() => close());

  it('returns last N lines of the log file', () => {
    const logPath = logPathForSlug('logtest');
    writeFileSync(logPath, Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n'));
    db.prepare(
      `INSERT INTO running_processes (project_id, pid, started_at, log_path, run_cmd) VALUES (?, ?, ?, ?, ?)`,
    ).run(projectId, 99999, Date.now(), logPath, 'x');
    const res = projectTailLogs(db, { project_id: projectId, lines: 5 });
    expect(res.lines).toEqual(['line 46', 'line 47', 'line 48', 'line 49', 'line 50']);
  });

  it('returns empty array when no runbook has ever run', () => {
    const logPath = logPathForSlug('neverlogged-xyz');
    rmSync(logPath, { force: true });
    const p = projectCreate(db, { slug: 'neverlogged-xyz', name: 'N', repoPath: '/tmp' });
    const res = projectTailLogs(db, { project_id: p.id });
    expect(res.lines).toEqual([]);
  });
});
