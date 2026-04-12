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
    it('creates a context message', () => {
      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Session context',
        content: '## Context\nWorking on tasks feature',
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.item.type).toBe('context');
      expect(result.item.status).toBe('pending');
      expect(result.item.title).toBe('Session context');
      expect(result.item.projectId).toBe(projectId);
    });

    it('creates a reminder message', () => {
      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'reminder',
        title: 'Push branch',
        content: 'Push inter-session bus to main',
      });

      expect(result.item.type).toBe('reminder');
      expect(result.item.status).toBe('pending');
    });

    it('accepts optional metadata', () => {
      const result = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Context with metadata',
        content: 'details',
        metadata: { source: 'cli', sourceProject: 'cruchot' },
      });

      expect(result.item.metadata.source).toBe('cli');
      expect(result.item.metadata.sourceProject).toBe('cruchot');
    });

    it('throws on unknown project slug', () => {
      expect(() =>
        messageCreate(db, {
          projectSlug: 'nonexistent',
          type: 'context',
          title: 'Test',
          content: 'Test',
        }),
      ).toThrow(/project.*not found/i);
    });

    it('rejects old type "issue"', () => {
      expect(() =>
        messageCreate(db, {
          projectSlug: 'agent-brain',
          type: 'issue' as any,
          title: 'Test',
          content: 'Test',
        }),
      ).toThrow();
    });

    it('rejects old type "task"', () => {
      expect(() =>
        messageCreate(db, {
          projectSlug: 'agent-brain',
          type: 'task' as any,
          title: 'Test',
          content: 'Test',
        }),
      ).toThrow();
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
        type: 'context',
        title: 'Context 1',
        content: 'details',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'reminder',
        title: 'Reminder 1',
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
        type: 'context',
        title: 'AB context',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'cruchot',
        type: 'reminder',
        title: 'Cruchot reminder',
        content: 'x',
      });

      const result = messageList(db, { projectSlug: 'agent-brain' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('AB context');
      expect(result.pendingCount).toBe(1);
    });

    it('filters by type', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Context',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'reminder',
        title: 'Reminder',
        content: 'x',
      });

      const result = messageList(db, { type: 'context' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('context');
    });

    it('filters by since timestamp', () => {
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
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
          type: 'context',
          title: `Context ${i}`,
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
        type: 'context',
        title: 'First',
        content: 'x',
      });
      messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Second',
        content: 'x',
      });

      const result = messageList(db, {});
      expect(result.items[0].title).toBe('Second');
      expect(result.items[1].title).toBe('First');
    });
  });

  describe('message_update', () => {
    it('updates status to done', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'reminder',
        title: 'Push branch',
        content: 'x',
      });

      const result = messageUpdate(db, { id, status: 'done' });
      expect(result.ok).toBe(true);
      expect(result.item.status).toBe('done');
      expect(result.item.updatedAt).toBeGreaterThanOrEqual(result.item.createdAt);
    });

    it('updates content', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Context',
        content: 'original',
      });

      const result = messageUpdate(db, { id, content: 'replaced content' });
      expect(result.item.content).toBe('replaced content');
    });

    it('merges metadata without overwriting existing keys', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Context',
        content: 'x',
        metadata: { source: 'cli', sourceProject: 'cruchot' },
      });

      const result = messageUpdate(db, {
        id,
        metadata: { custom: 'value' },
      });

      expect(result.item.metadata.source).toBe('cli');
      expect(result.item.metadata.sourceProject).toBe('cruchot');
      expect(result.item.metadata.custom).toBe('value');
    });

    it('throws on nonexistent message id', () => {
      expect(() =>
        messageUpdate(db, {
          id: '00000000-0000-0000-0000-000000000001',
          status: 'done',
        }),
      ).toThrow(/not found/i);
    });

    it('rejects old status "ack"', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Context',
        content: 'x',
      });

      expect(() =>
        messageUpdate(db, { id, status: 'ack' as any }),
      ).toThrow();
    });

    it('rejects invalid status', () => {
      const { id } = messageCreate(db, {
        projectSlug: 'agent-brain',
        type: 'context',
        title: 'Context',
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
        type: 'context',
        title: 'Contract test',
        content: 'x',
      });

      expect(() => schema.parse(result)).not.toThrow();
    });
  });
});
