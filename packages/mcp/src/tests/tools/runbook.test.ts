import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { projectGetRunbook, projectSetRunbook } from '../../tools/runbook.js';

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
