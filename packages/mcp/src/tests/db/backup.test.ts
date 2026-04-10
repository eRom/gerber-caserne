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

    // Insert a note
    db.prepare(`
      INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
      VALUES ('n-backup-1', '00000000-0000-0000-0000-000000000000', 'atom', 'Backup Test Note', 'backup content', '[]', 'active', 'ai', 'hash-backup-1', 1, 1)
    `).run();

    // Perform checkpoint + copy
    const size = checkpointAndCopy(db, backupPath);

    // Backup file must exist and be non-empty
    expect(existsSync(backupPath)).toBe(true);
    expect(size).toBeGreaterThan(0);

    // Open the backup and read the note back
    const backup = openDatabase(backupPath);
    const row = backup.prepare("SELECT title, content FROM notes WHERE id = 'n-backup-1'").get() as
      | { title: string; content: string }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.title).toBe('Backup Test Note');
    expect(row!.content).toBe('backup content');

    // Clean up
    backup.close();
    db.close();
  });
});
