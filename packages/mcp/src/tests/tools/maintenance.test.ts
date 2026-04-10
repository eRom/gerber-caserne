import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { noteCreate } from '../../tools/notes.js';
import { backupBrain, getStats } from '../../tools/maintenance.js';
import { mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StatsSchema } from '@agent-brain/shared';

describe('maintenance tools', () => {
  let db: Database;
  let close: () => void;
  let tmpDir: string;

  beforeEach(async () => {
    ({ db, close } = freshDb());
    tmpDir = mkdtempSync(join(tmpdir(), 'brain-test-'));
    // Seed some data
    await noteCreate(db, { kind: 'atom', title: 'A1', content: 'content1', tags: ['tag1'], source: 'ai' });
    await noteCreate(db, { kind: 'document', title: 'D1', content: '## H1\n\nBody 1.\n\n## H2\n\nBody 2.', tags: ['tag1', 'tag2'], source: 'human' });
  });
  afterEach(() => close());

  describe('backup_brain', () => {
    it('creates a backup file', async () => {
      // backup_brain needs a file-backed DB, but we can test the function structure
      // For :memory: DB, checkpoint will work but copy won't
      // So test with freshDb that uses a file
      const fileTmpDir = mkdtempSync(join(tmpdir(), 'brain-file-'));
      const dbPath = join(fileTmpDir, 'test.db');
      const { openDatabase } = await import('../../db/index.js');
      const { applyMigrations } = await import('../../db/migrate.js');
      const fileDb = openDatabase(dbPath);
      applyMigrations(fileDb);

      const result = backupBrain(fileDb, { label: 'snapshot' }, fileTmpDir);
      expect(result.ok).toBe(true);
      expect(result.path).toBeDefined();
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(existsSync(result.path)).toBe(true);
      fileDb.close();
    });
  });

  describe('get_stats', () => {
    it('returns valid Stats shape', () => {
      const result = getStats(db, {});
      expect(() => StatsSchema.parse(result)).not.toThrow();
    });

    it('counts projects, notes, chunks correctly', () => {
      const result = getStats(db, {});
      expect(result.projects).toBeGreaterThanOrEqual(1); // at least global
      expect(result.notes.total).toBe(2); // 1 atom + 1 doc
      expect(result.notes.byKind.atom).toBe(1);
      expect(result.notes.byKind.document).toBe(1);
      expect(result.chunks.total).toBeGreaterThanOrEqual(2); // doc has chunks
    });

    it('reports top tags', () => {
      const result = getStats(db, {});
      expect(result.topTags.length).toBeGreaterThanOrEqual(1);
      expect(result.topTags[0]!.tag).toBeDefined();
      expect(result.topTags[0]!.count).toBeGreaterThan(0);
    });
  });
});
