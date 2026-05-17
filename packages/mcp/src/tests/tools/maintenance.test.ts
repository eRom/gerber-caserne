import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { backupBrain, getStats } from '../../tools/maintenance.js';
import { messageCreate } from '../../tools/messages.js';
import { mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StatsSchema } from '@gerber-caserne/shared';

describe('maintenance tools', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
    // Seed a couple of messages on the seeded "global" project.
    messageCreate(db, { projectSlug: 'global', type: 'context', title: 'M1', content: 'c1' });
    messageCreate(db, { projectSlug: 'global', type: 'reminder', title: 'M2', content: 'c2' });
  });
  afterEach(() => close());

  describe('backup_brain', () => {
    it('creates a backup file', async () => {
      // backup_brain needs a file-backed DB, so spin one up in a temp dir.
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

    it('counts projects and messages correctly', () => {
      const result = getStats(db, {});
      expect(result.projects).toBeGreaterThanOrEqual(1); // at least global + caserne
      expect(result.messages.total).toBe(2);
    });
  });
});
