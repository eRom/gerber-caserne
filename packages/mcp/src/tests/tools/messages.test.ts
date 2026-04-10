import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { messageCreate, messageList, messageUpdate } from '../../tools/messages.js';
import { MutationResponseSchema, MessageSchema } from '@agent-brain/shared';

describe('message tools', () => {
  let db: Database;
  let close: () => void;
  let projectId: string;

  beforeEach(() => {
    ({ db, close } = freshDb());
    const proj = projectCreate(db, { slug: 'agent-brain', name: 'Agent Brain' });
    projectId = proj.id;
  });
  afterEach(() => close());

  describe('message_create', () => {
    it('creates a message and returns it', () => {
      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'FTS5 fulltext retourne 0 résultats',
        content: '## Repro\n1. search → 0 hits',
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.item.type).toBe('issue');
      expect(result.item.status).toBe('pending');
      expect(result.item.priority).toBe('normal');
      expect(result.item.title).toBe('FTS5 fulltext retourne 0 résultats');
      expect(result.item.projectId).toBe(projectId);
    });

    it('accepts optional priority and metadata', () => {
      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'High prio bug',
        content: 'details',
        priority: 'high',
        metadata: { severity: 'bug', sourceProject: 'cruchot' },
      });

      expect(result.item.priority).toBe('high');
      expect(result.item.metadata.severity).toBe('bug');
      expect(result.item.metadata.sourceProject).toBe('cruchot');
    });

    it('throws on unknown project slug', () => {
      expect(() =>
        messageCreate(db, {
          projectSlug: 'nonexistent',
          type: 'issue',
          title: 'Test',
          content: 'Test',
        }),
      ).toThrow(/project.*not found/i);
    });

    it('rejects invalid type', () => {
      expect(() =>
        messageCreate(db, {
          projectSlug: 'agent-brain',
          type: 'invalid' as any,
          title: 'Test',
          content: 'Test',
        }),
      ).toThrow();
    });
  });

  describe('message_list', () => {
    it('returns all messages when no filters', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug 1',
        content: 'details',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'task',
        title: 'Task 1',
        content: 'details',
      });

      const result = messageList(db, {});
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.pendingCount).toBe(2);
    });

    it('filters by projectSlug', () => {
      projectCreate(db, { slug: 'cruchot', name: 'Cruchot' });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'AB issue',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'cruchot',
        type: 'task',
        title: 'Cruchot task',
        content: 'x',
      });

      const result = messageList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('AB issue');
      expect(result.pendingCount).toBe(1);
    });

    it('filters by type and status', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Issue',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'task',
        title: 'Task',
        content: 'x',
      });

      const result = messageList(db, { type: 'issue' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('issue');
    });

    it('filters by since timestamp', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Old',
        content: 'x',
      });
      const after = Date.now() + 1;
      const result = messageList(db, { since: after });
      expect(result.items).toHaveLength(0);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        messageCreate(db, {
          projectSlug: 'agent-brain',
          type: 'issue',
          title: `Bug ${i}`,
          content: 'x',
        });
      }

      const result = messageList(db, { limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('returns items sorted by createdAt DESC', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'First',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Second',
        content: 'x',
      });

      const result = messageList(db, {});
      expect(result.items[0].title).toBe('Second');
      expect(result.items[1].title).toBe('First');
    });
  });

  describe('message_update', () => {
    it('updates status', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'x',
      });

      const result = messageUpdate(db, { id, status: 'ack' });
      expect(result.ok).toBe(true);
      expect(result.item.status).toBe('ack');
      expect(result.item.updatedAt).toBeGreaterThanOrEqual(result.item.createdAt);
    });

    it('updates content', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'original',
      });

      const result = messageUpdate(db, { id, content: 'replaced content' });
      expect(result.item.content).toBe('replaced content');
    });

    it('merges metadata without overwriting existing keys', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'x',
        metadata: { severity: 'bug', sourceProject: 'cruchot' },
      });

      const result = messageUpdate(db, {
        id,
        metadata: { assignee: 'agent-brain' },
      });

      expect(result.item.metadata.severity).toBe('bug');
      expect(result.item.metadata.sourceProject).toBe('cruchot');
      expect(result.item.metadata.assignee).toBe('agent-brain');
    });

    it('throws on nonexistent message id', () => {
      expect(() =>
        messageUpdate(db, {
          id: '00000000-0000-0000-0000-000000000001',
          status: 'done',
        }),
      ).toThrow(/not found/i);
    });

    it('rejects invalid status', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Bug',
        content: 'x',
      });

      expect(() =>
        messageUpdate(db, { id, status: 'invalid' as any }),
      ).toThrow();
    });
  });

  describe('contracts', () => {
    it('messageCreate return matches MutationResponseSchema(MessageSchema)', () => {
      const schema = MutationResponseSchema(MessageSchema);

      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'issue',
        title: 'Contract test',
        content: 'x',
      });

      expect(() => schema.parse(result)).not.toThrow();
    });
  });
});
