import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';

describe('restore script', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'restore-test-'));
  });

  it('refuses restore when lock file exists', async () => {
    const lockPath = join(tmpDir, 'restore.lock');
    writeFileSync(lockPath, 'locked');

    const { restore } = await import('../../scripts/restore.js');
    await expect(restore(join(tmpDir, 'source.db'), join(tmpDir, 'brain.db'), tmpDir)).rejects.toThrow(/lock|already in progress/i);
  });

  it('copies source DB over target', async () => {
    const sourcePath = join(tmpDir, 'source.db');
    const targetPath = join(tmpDir, 'brain.db');

    // Create source DB with a note
    const sourceDb = openDatabase(sourcePath);
    applyMigrations(sourceDb);
    sourceDb.prepare(`INSERT INTO notes (id, project_id, kind, title, content, tags, status, source, content_hash, created_at, updated_at)
                      VALUES ('n1','00000000-0000-0000-0000-000000000000','atom','Restored','content','[]','active','ai','h',1,1)`).run();
    sourceDb.close();

    // Create empty target
    const targetDb = openDatabase(targetPath);
    applyMigrations(targetDb);
    targetDb.close();

    const { restore } = await import('../../scripts/restore.js');
    await restore(sourcePath, targetPath, tmpDir);

    // Verify target now has the note
    const verifyDb = openDatabase(targetPath);
    const row = verifyDb.prepare("SELECT title FROM notes WHERE id='n1'").get() as any;
    expect(row?.title).toBe('Restored');
    verifyDb.close();
  });
});
