import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { projectCreate } from '../../tools/projects.js';
import { messageCreate } from '../../tools/messages.js';

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
});
