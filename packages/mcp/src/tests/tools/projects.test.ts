import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';
import { projectCreate, projectList, projectUpdate, projectDelete } from '../../tools/projects.js';

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

  it('project_delete reassigns notes to global', () => {
    const { id: projId } = projectCreate(db, { slug: 'doomed', name: 'Doomed' });
    // Insert a note directly in DB for this test
    db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
                VALUES ('n1', ?, 'atom', 't', 'c', '[]', 'active', 'ai', 'h', 1, 1)`).run(projId);
    const result = projectDelete(db, { id: projId });
    expect(result.ok).toBe(true);
    expect(result.reassigned_count).toBe(1);
    // Verify note reassigned to global
    const note = db.prepare("SELECT project_id FROM notes WHERE id='n1'").get() as any;
    expect(note.project_id).toBe(GLOBAL_PROJECT_ID);
  });
});
