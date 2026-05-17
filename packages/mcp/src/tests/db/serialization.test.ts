import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { TaskSchema } from '@gerber-caserne/shared';

describe('tasks.tags JSON serialization', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => ({ db, close } = freshDb()));
  afterEach(() => close());

  it('round-trips tags through JSON.stringify / JSON.parse', () => {
    const tags = ['alpha', 'beta', 'gamma'];
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`INSERT INTO tasks (id, project_id, title, description, status, priority, position, tags, metadata, created_at, updated_at)
                VALUES (?, '00000000-0000-0000-0000-000000000000', 'T', '', 'inbox', 'normal', 0, ?, '{}', ?, ?)`
    ).run(id, JSON.stringify(tags), now, now);

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    const parsed = JSON.parse(row.tags);
    expect(parsed).toEqual(tags);
  });

  it('TaskSchema validates hydrated object with tags as string[]', () => {
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`INSERT INTO tasks (id, project_id, title, description, status, priority, position, tags, metadata, created_at, updated_at)
                VALUES (?, '00000000-0000-0000-0000-000000000000', 'Title', '', 'inbox', 'normal', 0, ?, '{}', ?, ?)`
    ).run(id, JSON.stringify(['test']), now, now);

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;

    const hydrated = {
      ...row,
      projectId: row.project_id,
      tags: JSON.parse(row.tags),
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      dueDate: row.due_date,
      waitingOn: row.waiting_on,
      completedAt: row.completed_at,
      parentId: row.parent_id,
    };

    expect(() => TaskSchema.parse(hydrated)).not.toThrow();
  });

  it('rejects malformed JSON tags', () => {
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`INSERT INTO tasks (id, project_id, title, description, status, priority, position, tags, metadata, created_at, updated_at)
                VALUES (?, '00000000-0000-0000-0000-000000000000', 'T', '', 'inbox', 'normal', 0, 'not-json', '{}', ?, ?)`
    ).run(id, now, now);

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    expect(() => JSON.parse(row.tags)).toThrow();
  });
});
