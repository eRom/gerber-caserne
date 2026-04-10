import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { NoteSchema } from '@agent-brain/shared';

describe('notes.tags JSON serialization', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => ({ db, close } = freshDb()));
  afterEach(() => close());

  it('round-trips tags through JSON.stringify / JSON.parse', () => {
    const tags = ['alpha', 'beta', 'gamma'];
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
                VALUES (?, '00000000-0000-0000-0000-000000000000', 'atom', 'T', 'C', ?, 'active', 'ai', 'h', ?, ?)`
    ).run(id, JSON.stringify(tags), now, now);

    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    const parsed = JSON.parse(row.tags);
    expect(parsed).toEqual(tags);
  });

  it('NoteSchema validates hydrated object with tags as string[]', () => {
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
                VALUES (?, '00000000-0000-0000-0000-000000000000', 'atom', 'Title', 'Content', ?, 'active', 'ai', 'hash123', ?, ?)`
    ).run(id, JSON.stringify(['test']), now, now);

    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;

    // Hydrate: map snake_case to camelCase + parse tags
    const hydrated = {
      id: row.id,
      projectId: row.project_id,
      kind: row.kind,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags),
      status: row.status,
      source: row.source,
      contentHash: row.content_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    expect(() => NoteSchema.parse(hydrated)).not.toThrow();
  });

  it('rejects malformed JSON tags', () => {
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
                VALUES (?, '00000000-0000-0000-0000-000000000000', 'atom', 'T', 'C', 'not-json', 'active', 'ai', 'h', ?, ?)`
    ).run(id, now, now);

    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    expect(() => JSON.parse(row.tags)).toThrow();
  });
});
