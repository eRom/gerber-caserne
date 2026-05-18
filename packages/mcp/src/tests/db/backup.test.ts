import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';
import { checkpointAndCopy } from '../../db/backup.js';

describe('checkpointAndCopy', () => {
  let tmpDir: string | null = null;

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('copies the WAL-flushed DB and the backup is readable', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'agent-brain-backup-test-'));
    const dbPath = join(tmpDir, 'brain.db');
    const backupPath = join(tmpDir, 'brain.backup.db');

    // Open a file-backed DB (not :memory:) so WAL works
    const db = openDatabase(dbPath);
    applyMigrations(db);

    // Insert a project to ensure backup roundtrips actual rows
    db.prepare(`
      INSERT INTO projects (id, slug, name, description, repo_path, color, created_at, updated_at)
      VALUES ('p-backup-1', 'backup-test', 'Backup Test Project', 'desc', '/tmp', '#abcdef', 1, 1)
    `).run();

    // Perform checkpoint + copy
    const size = checkpointAndCopy(db, backupPath);

    // Backup file must exist and be non-empty
    expect(existsSync(backupPath)).toBe(true);
    expect(size).toBeGreaterThan(0);

    // Open the backup and read the project back
    const backup = openDatabase(backupPath);
    const row = backup.prepare("SELECT slug, name FROM projects WHERE id = 'p-backup-1'").get() as
      | { slug: string; name: string }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.slug).toBe('backup-test');
    expect(row!.name).toBe('Backup Test Project');

    // Clean up
    backup.close();
    db.close();
  });
});
