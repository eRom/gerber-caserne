import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import { backupBrain, getStats } from '../../tools/maintenance.js';
import { mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StatsSchema } from '@gerber-caserne/shared';

describe('maintenance tools', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
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

    it('counts projects correctly', () => {
      const result = getStats(db, {});
      expect(result.projects).toBeGreaterThanOrEqual(1); // at least the seeded "global" project
    });
  });
});
