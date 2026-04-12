import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { taskCreate } from '../../tools/tasks.js';
import {
  issueCreate,
  issueList,
  issueGet,
  issueUpdate,
  issueClose,
} from '../../tools/issues.js';

describe('issue tools', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const proj = projectCreate(db, { slug: 'agent-brain', name: 'Agent Brain' });
    projectId = proj.id;
  });
  afterEach(() => close());

  // ---------------------------------------------------------------------------
  // issueCreate
  // ---------------------------------------------------------------------------

  describe('issueCreate', () => {
    it('creates an issue with defaults (status=open, priority=normal, severity=bug)', () => {
      const result = issueCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Login page crashes',
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.item.title).toBe('Login page crashes');
      expect(result.item.status).toBe('open');
      expect(result.item.priority).toBe('normal');
      expect(result.item.severity).toBe('bug');
      expect(result.item.description).toBe('');
      expect(result.item.tags).toEqual([]);
      expect(result.item.metadata).toEqual({});
      expect(result.item.projectId).toBe(projectId);
      expect(result.item.assignee).toBeNull();
      expect(result.item.relatedTaskId).toBeNull();
    });

    it('creates an issue with all fields', () => {
      const result = issueCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Performance regression',
        description: 'Slow query on dashboard',
        severity: 'regression',
        priority: 'high',
        assignee: 'romain',
        tags: ['backend', 'db'],
        metadata: { source: 'cli', reporter: 'alice' },
      });

      expect(result.item.title).toBe('Performance regression');
      expect(result.item.description).toBe('Slow query on dashboard');
      expect(result.item.severity).toBe('regression');
      expect(result.item.priority).toBe('high');
      expect(result.item.assignee).toBe('romain');
      expect(result.item.tags).toEqual(['backend', 'db']);
      expect(result.item.metadata.source).toBe('cli');
      expect(result.item.metadata.reporter).toBe('alice');
    });

    it('throws on unknown project slug', () => {
      expect(() =>
        issueCreate(db, {
          projectSlug: 'nonexistent',
          title: 'Bug',
        }),
      ).toThrow(/project.*not found/i);
    });

    it('rejects invalid severity', () => {
      expect(() =>
        issueCreate(db, {
          projectSlug: 'agent-brain',
          title: 'Bug',
          severity: 'critical' as any,
        }),
      ).toThrow();
    });

    it('rejects invalid priority', () => {
      expect(() =>
        issueCreate(db, {
          projectSlug: 'agent-brain',
          title: 'Bug',
          priority: 'urgent' as any,
        }),
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // issueList
  // ---------------------------------------------------------------------------

  describe('issueList', () => {
    it('returns all issues when no filters', () => {
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Bug 1' });
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Bug 2' });

      const result = issueList(db, {});
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by project slug', () => {
      projectCreate(db, { slug: 'other-project', name: 'Other' });
      issueCreate(db, { projectSlug: 'agent-brain', title: 'AB Bug' });
      issueCreate(db, { projectSlug: 'other-project', title: 'Other Bug' });

      const result = issueList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('AB Bug');
    });

    it('filters by severity', () => {
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Regression', severity: 'regression' });
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Warn', severity: 'warning' });

      const result = issueList(db, { severity: 'regression' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Regression');
    });

    it('filters by status', () => {
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Open issue' });
      const closed = issueCreate(db, { projectSlug: 'agent-brain', title: 'Closed issue' });
      issueClose(db, { id: closed.id });

      const result = issueList(db, { status: 'open' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Open issue');
    });

    it('filters by priority', () => {
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Critical', priority: 'critical' });
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Low', priority: 'low' });

      const result = issueList(db, { priority: 'critical' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Critical');
    });

    it('filters by tags_any using json_each', () => {
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Tagged', tags: ['auth', 'api'] });
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Untagged', tags: [] });

      const result = issueList(db, { tags_any: ['auth'] });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Tagged');
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        issueCreate(db, { projectSlug: 'agent-brain', title: `Issue ${i}` });
      }

      const result = issueList(db, { limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('returns items sorted by createdAt DESC', () => {
      const first = issueCreate(db, { projectSlug: 'agent-brain', title: 'First' });
      // Force a distinct timestamp by bumping updated_at directly
      db.prepare('UPDATE issues SET created_at = created_at - 1 WHERE id = ?').run(first.id);
      issueCreate(db, { projectSlug: 'agent-brain', title: 'Second' });

      const result = issueList(db, {});
      expect(result.items[0].title).toBe('Second');
      expect(result.items[1].title).toBe('First');
    });
  });

  // ---------------------------------------------------------------------------
  // issueGet
  // ---------------------------------------------------------------------------

  describe('issueGet', () => {
    it('returns the issue by id', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'My issue' });

      const result = issueGet(db, { id });
      expect(result.item.id).toBe(id);
      expect(result.item.title).toBe('My issue');
    });

    it('throws on not found', () => {
      expect(() =>
        issueGet(db, { id: '00000000-0000-0000-0000-000000000001' }),
      ).toThrow(/not found/i);
    });

    it('rejects invalid uuid', () => {
      expect(() =>
        issueGet(db, { id: 'not-a-uuid' }),
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // issueUpdate
  // ---------------------------------------------------------------------------

  describe('issueUpdate', () => {
    it('updates status', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue' });
      const result = issueUpdate(db, { id, status: 'in_progress' });

      expect(result.ok).toBe(true);
      expect(result.item.status).toBe('in_progress');
    });

    it('updates severity', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue', severity: 'bug' });
      const result = issueUpdate(db, { id, severity: 'regression' });

      expect(result.item.severity).toBe('regression');
    });

    it('links to a task via relatedTaskId', () => {
      const task = taskCreate(db, { projectSlug: 'agent-brain', title: 'Related task' });
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue' });

      const result = issueUpdate(db, { id, relatedTaskId: task.id });
      expect(result.item.relatedTaskId).toBe(task.id);
    });

    it('clears relatedTaskId with null', () => {
      const task = taskCreate(db, { projectSlug: 'agent-brain', title: 'Related task' });
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue' });
      issueUpdate(db, { id, relatedTaskId: task.id });

      const result = issueUpdate(db, { id, relatedTaskId: null });
      expect(result.item.relatedTaskId).toBeNull();
    });

    it('merges metadata without overwriting existing keys', () => {
      const { id } = issueCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Issue',
        metadata: { source: 'cli', reporter: 'alice' },
      });

      const result = issueUpdate(db, { id, metadata: { custom: 'value' } });
      expect(result.item.metadata.source).toBe('cli');
      expect(result.item.metadata.reporter).toBe('alice');
      expect(result.item.metadata.custom).toBe('value');
    });

    it('updates title and description', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Old title' });

      const result = issueUpdate(db, { id, title: 'New title', description: 'New desc' });
      expect(result.item.title).toBe('New title');
      expect(result.item.description).toBe('New desc');
    });

    it('updates tags', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue', tags: ['old'] });

      const result = issueUpdate(db, { id, tags: ['new', 'updated'] });
      expect(result.item.tags).toEqual(['new', 'updated']);
    });

    it('clears assignee with null', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue', assignee: 'romain' });

      const result = issueUpdate(db, { id, assignee: null });
      expect(result.item.assignee).toBeNull();
    });

    it('updates updatedAt', () => {
      const { id, item } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue' });
      const result = issueUpdate(db, { id, title: 'Updated' });

      expect(result.item.updatedAt).toBeGreaterThanOrEqual(item.createdAt);
    });

    it('throws on nonexistent issue id', () => {
      expect(() =>
        issueUpdate(db, { id: '00000000-0000-0000-0000-000000000001', title: 'X' }),
      ).toThrow(/not found/i);
    });

    it('rejects invalid status', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Issue' });
      expect(() =>
        issueUpdate(db, { id, status: 'invalid' as any }),
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // issueClose
  // ---------------------------------------------------------------------------

  describe('issueClose', () => {
    it('sets status to closed', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Open issue' });
      const result = issueClose(db, { id });

      expect(result.ok).toBe(true);
      expect(result.id).toBe(id);
      expect(result.item.status).toBe('closed');
    });

    it('updates updatedAt when closing', () => {
      const { id, item } = issueCreate(db, { projectSlug: 'agent-brain', title: 'Open issue' });
      const result = issueClose(db, { id });

      expect(result.item.updatedAt).toBeGreaterThanOrEqual(item.createdAt);
    });

    it('can close an already in_progress issue', () => {
      const { id } = issueCreate(db, { projectSlug: 'agent-brain', title: 'In progress issue' });
      issueUpdate(db, { id, status: 'in_progress' });

      const result = issueClose(db, { id });
      expect(result.item.status).toBe('closed');
    });

    it('throws on nonexistent issue id', () => {
      expect(() =>
        issueClose(db, { id: '00000000-0000-0000-0000-000000000001' }),
      ).toThrow(/not found/i);
    });
  });
});
