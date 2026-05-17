import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { GLOBAL_PROJECT_ID } from '@gerber-caserne/shared';
import { projectCreate, projectList, projectUpdate, projectDelete } from '../../tools/projects.js';
import { projectRun, projectSetRunbook } from '../../tools/runbook.js';

describe('project tools', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  it('project_create creates a project and returns it', () => {
    const result = projectCreate(db, { slug: 'cruchot', name: 'Cruchot' });
    expect(result.ok).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.item?.slug).toBe('cruchot');
    // Verify in DB
    const row = db.prepare("SELECT slug FROM projects WHERE slug='cruchot'").get() as any;
    expect(row).toBeDefined();
  });

  it('duplicate slug throws', () => {
    projectCreate(db, { slug: 'dup', name: 'Dup' });
    expect(() => projectCreate(db, { slug: 'dup', name: 'Dup2' })).toThrow();
  });

  it('project_list includes global + created projects', () => {
    projectCreate(db, { slug: 'test-proj', name: 'Test' });
    const result = projectList(db, {});
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    const slugs = result.items.map((p: any) => p.slug);
    expect(slugs).toContain('global');
    expect(slugs).toContain('test-proj');
  });

  it('project_update patches fields', () => {
    const { id } = projectCreate(db, { slug: 'upd', name: 'Before' });
    const result = projectUpdate(db, { id, name: 'After' });
    expect(result.ok).toBe(true);
    expect(result.item?.name).toBe('After');
  });

  it('project_delete refuses GLOBAL_PROJECT_ID', () => {
    expect(() => projectDelete(db, { id: GLOBAL_PROJECT_ID })).toThrow();
  });

  it('project_delete removes the project row', () => {
    const { id: projId } = projectCreate(db, { slug: 'doomed', name: 'Doomed' });
    const result = projectDelete(db, { id: projId });
    expect(result.ok).toBe(true);
    expect(result.id).toBe(projId);
    const row = db.prepare("SELECT id FROM projects WHERE id = ?").get(projId);
    expect(row).toBeUndefined();
  });
});

describe('project_list is_running enrichment', () => {
  it('marks running projects with isRunning=true', () => {
    const { db, close } = freshDb();
    const p = projectCreate(db, { slug: 'isrunning', name: 'R', repoPath: '/tmp' });
    projectSetRunbook(db, { project_id: p.id, run_cmd: 'sleep 5' });
    const { pid } = projectRun(db, { project_id: p.id });

    const list = projectList(db, {});
    const row = list.items.find((x: any) => x.id === p.id);
    expect(row!.isRunning).toBe(true);

    try { process.kill(pid, 'SIGTERM'); } catch {}
    close();
  });

  it('marks non-running projects with isRunning=false', () => {
    const { db, close } = freshDb();
    projectCreate(db, { slug: 'noprun', name: 'N', repoPath: '/tmp' });
    const list = projectList(db, {});
    const row = list.items.find((x: any) => x.slug === 'noprun');
    expect(row!.isRunning).toBe(false);
    close();
  });
});
