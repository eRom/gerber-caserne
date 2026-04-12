import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import {
  taskCreate,
  taskList,
  taskGet,
  taskUpdate,
  taskDelete,
  taskReorder,
} from '../../tools/tasks.js';

describe('task tools', () => {
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
  // taskCreate
  // ---------------------------------------------------------------------------

  describe('taskCreate', () => {
    it('creates a task with defaults', () => {
      const result = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'My first task',
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.item.title).toBe('My first task');
      expect(result.item.status).toBe('active');
      expect(result.item.priority).toBe('normal');
      expect(result.item.description).toBe('');
      expect(result.item.tags).toEqual([]);
      expect(result.item.metadata).toEqual({});
      expect(result.item.projectId).toBe(projectId);
      expect(result.item.parentId).toBeNull();
      expect(result.item.completedAt).toBeNull();
      expect(result.item.position).toBe(0);
    });

    it('creates a task with all fields', () => {
      const result = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Full task',
        description: 'A detailed description',
        status: 'waiting',
        priority: 'high',
        assignee: 'romain',
        tags: ['backend', 'urgent'],
        dueDate: 1700000000000,
        waitingOn: 'client approval',
        metadata: { source: 'cli', relatedNoteIds: [] },
      });

      expect(result.item.title).toBe('Full task');
      expect(result.item.description).toBe('A detailed description');
      expect(result.item.status).toBe('waiting');
      expect(result.item.priority).toBe('high');
      expect(result.item.assignee).toBe('romain');
      expect(result.item.tags).toEqual(['backend', 'urgent']);
      expect(result.item.dueDate).toBe(1700000000000);
      expect(result.item.waitingOn).toBe('client approval');
      expect(result.item.metadata.source).toBe('cli');
    });

    it('sets completedAt when status is done', () => {
      const before = Date.now();
      const result = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Done task',
        status: 'done',
      });
      const after = Date.now();

      expect(result.item.completedAt).toBeGreaterThanOrEqual(before);
      expect(result.item.completedAt).toBeLessThanOrEqual(after);
    });

    it('does not set completedAt for non-done status', () => {
      const result = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Active task',
        status: 'active',
      });

      expect(result.item.completedAt).toBeNull();
    });

    it('creates a subtask with parentId', () => {
      const parent = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Parent task',
      });

      const subtask = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Subtask',
        parentId: parent.id,
      });

      expect(subtask.item.parentId).toBe(parent.id);
      expect(subtask.item.position).toBe(0);
    });

    it('auto-increments position within same status', () => {
      const t1 = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task 1' });
      const t2 = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task 2' });
      const t3 = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task 3' });

      expect(t1.item.position).toBe(0);
      expect(t2.item.position).toBe(1);
      expect(t3.item.position).toBe(2);
    });

    it('throws on unknown project slug', () => {
      expect(() =>
        taskCreate(db, { projectSlug: 'nonexistent', title: 'Task' }),
      ).toThrow(/project.*not found/i);
    });

    it('rejects invalid status', () => {
      expect(() =>
        taskCreate(db, {
          projectSlug: 'agent-brain',
          title: 'Task',
          status: 'invalid' as any,
        }),
      ).toThrow();
    });

    it('rejects invalid priority', () => {
      expect(() =>
        taskCreate(db, {
          projectSlug: 'agent-brain',
          title: 'Task',
          priority: 'critical' as any,
        }),
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // taskList
  // ---------------------------------------------------------------------------

  describe('taskList', () => {
    it('returns all top-level tasks by default', () => {
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Task A' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Task B' });

      const result = taskList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by project slug', () => {
      projectCreate(db, { slug: 'other-project', name: 'Other' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'AB Task' });
      taskCreate(db, { projectSlug: 'other-project', title: 'Other Task' });

      const result = taskList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('AB Task');
    });

    it('filters by status', () => {
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Active Task', status: 'active' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Done Task', status: 'done' });

      const result = taskList(db, { projectSlug: 'agent-brain', status: 'active' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Active Task');
    });

    it('filters by priority', () => {
      taskCreate(db, { projectSlug: 'agent-brain', title: 'High', priority: 'high' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Low', priority: 'low' });

      const result = taskList(db, { projectSlug: 'agent-brain', priority: 'high' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('High');
    });

    it('excludes subtasks by default', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Subtask', parentId: parent.id });

      const result = taskList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Parent');
    });

    it('includes subtasks when parentId is given', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Subtask 1', parentId: parent.id });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Subtask 2', parentId: parent.id });

      const result = taskList(db, { parentId: parent.id });
      expect(result.items).toHaveLength(2);
      expect(result.items.every(t => t.parentId === parent.id)).toBe(true);
    });

    it('filters by tags_any', () => {
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Tagged', tags: ['backend', 'api'] });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Untagged', tags: [] });

      const result = taskList(db, { projectSlug: 'agent-brain', tags_any: ['api'] });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Tagged');
    });

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        taskCreate(db, { projectSlug: 'agent-brain', title: `Task ${i}` });
      }

      const page1 = taskList(db, { projectSlug: 'agent-brain', limit: 2, offset: 0 });
      const page2 = taskList(db, { projectSlug: 'agent-brain', limit: 2, offset: 2 });

      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.items[0].title).not.toBe(page2.items[0].title);
    });

    it('sorts by position by default', () => {
      const t1 = taskCreate(db, { projectSlug: 'agent-brain', title: 'First' });
      const t2 = taskCreate(db, { projectSlug: 'agent-brain', title: 'Second' });

      const result = taskList(db, { projectSlug: 'agent-brain' });
      expect(result.items[0].position).toBeLessThanOrEqual(result.items[1].position);
    });
  });

  // ---------------------------------------------------------------------------
  // taskGet
  // ---------------------------------------------------------------------------

  describe('taskGet', () => {
    it('returns a task with subtasks', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Sub A', parentId: parent.id });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Sub B', parentId: parent.id });

      const result = taskGet(db, { id: parent.id });
      expect(result.item.title).toBe('Parent');
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks.every(s => s.parentId === parent.id)).toBe(true);
    });

    it('returns empty subtasks array for leaf tasks', () => {
      const task = taskCreate(db, { projectSlug: 'agent-brain', title: 'Leaf' });
      const result = taskGet(db, { id: task.id });
      expect(result.subtasks).toEqual([]);
    });

    it('throws on not found', () => {
      expect(() =>
        taskGet(db, { id: '00000000-0000-0000-0000-000000000001' }),
      ).toThrow(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // taskUpdate
  // ---------------------------------------------------------------------------

  describe('taskUpdate', () => {
    it('updates title', () => {
      const { id } = taskCreate(db, { projectSlug: 'agent-brain', title: 'Old title' });
      const result = taskUpdate(db, { id, title: 'New title' });
      expect(result.ok).toBe(true);
      expect(result.item.title).toBe('New title');
    });

    it('updates status to done and sets completedAt', () => {
      const { id } = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task' });
      const before = Date.now();
      const result = taskUpdate(db, { id, status: 'done' });
      const after = Date.now();

      expect(result.item.status).toBe('done');
      expect(result.item.completedAt).toBeGreaterThanOrEqual(before);
      expect(result.item.completedAt).toBeLessThanOrEqual(after);
    });

    it('clears completedAt when moving out of done', () => {
      const { id } = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task', status: 'done' });
      expect(taskGet(db, { id }).item.completedAt).not.toBeNull();

      const result = taskUpdate(db, { id, status: 'active' });
      expect(result.item.completedAt).toBeNull();
    });

    it('merges metadata without overwriting existing keys', () => {
      const { id } = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Task',
        metadata: { source: 'cli', custom: 'keep me' },
      });

      const result = taskUpdate(db, { id, metadata: { extra: 'added' } });
      expect(result.item.metadata.source).toBe('cli');
      expect(result.item.metadata.custom).toBe('keep me');
      expect(result.item.metadata.extra).toBe('added');
    });

    it('updates tags', () => {
      const { id } = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Task',
        tags: ['old'],
      });

      const result = taskUpdate(db, { id, tags: ['new', 'updated'] });
      expect(result.item.tags).toEqual(['new', 'updated']);
    });

    it('clears assignee with null', () => {
      const { id } = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Task',
        assignee: 'romain',
      });

      const result = taskUpdate(db, { id, assignee: null });
      expect(result.item.assignee).toBeNull();
    });

    it('clears dueDate with null', () => {
      const { id } = taskCreate(db, {
        projectSlug: 'agent-brain',
        title: 'Task',
        dueDate: 1700000000000,
      });

      const result = taskUpdate(db, { id, dueDate: null });
      expect(result.item.dueDate).toBeNull();
    });

    it('updates updatedAt', () => {
      const { id, item } = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task' });
      const result = taskUpdate(db, { id, title: 'Updated' });
      expect(result.item.updatedAt).toBeGreaterThanOrEqual(item.createdAt);
    });

    it('throws on nonexistent task id', () => {
      expect(() =>
        taskUpdate(db, { id: '00000000-0000-0000-0000-000000000001', title: 'X' }),
      ).toThrow(/not found/i);
    });

    it('rejects invalid status', () => {
      const { id } = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task' });
      expect(() =>
        taskUpdate(db, { id, status: 'invalid' as any }),
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // taskDelete
  // ---------------------------------------------------------------------------

  describe('taskDelete', () => {
    it('deletes a task without subtasks', () => {
      const { id } = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task' });
      const result = taskDelete(db, { id });

      expect(result.ok).toBe(true);
      expect(result.id).toBe(id);
      expect(result.deletedCount).toBe(1);
      expect(() => taskGet(db, { id })).toThrow(/not found/i);
    });

    it('deletes task and subtasks, returns correct deletedCount', () => {
      const parent = taskCreate(db, { projectSlug: 'agent-brain', title: 'Parent' });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Sub 1', parentId: parent.id });
      taskCreate(db, { projectSlug: 'agent-brain', title: 'Sub 2', parentId: parent.id });

      const result = taskDelete(db, { id: parent.id });
      expect(result.deletedCount).toBe(3);

      const remaining = taskList(db, { projectSlug: 'agent-brain' });
      expect(remaining.items).toHaveLength(0);
    });

    it('throws on nonexistent task id', () => {
      expect(() =>
        taskDelete(db, { id: '00000000-0000-0000-0000-000000000001' }),
      ).toThrow(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // taskReorder
  // ---------------------------------------------------------------------------

  describe('taskReorder', () => {
    it('sets positions correctly', () => {
      const t1 = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task 1' });
      const t2 = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task 2' });
      const t3 = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task 3' });

      // Reverse order
      const result = taskReorder(db, { ids: [t3.id, t1.id, t2.id] });
      expect(result.ok).toBe(true);

      const updated1 = taskGet(db, { id: t1.id });
      const updated2 = taskGet(db, { id: t2.id });
      const updated3 = taskGet(db, { id: t3.id });

      expect(updated3.item.position).toBe(0);
      expect(updated1.item.position).toBe(1);
      expect(updated2.item.position).toBe(2);
    });

    it('updates updatedAt for reordered tasks', () => {
      const { id, item } = taskCreate(db, { projectSlug: 'agent-brain', title: 'Task' });

      taskReorder(db, { ids: [id] });

      const updated = taskGet(db, { id });
      expect(updated.item.updatedAt).toBeGreaterThanOrEqual(item.createdAt);
    });

    it('rejects empty ids array', () => {
      expect(() => taskReorder(db, { ids: [] })).toThrow();
    });
  });
});
