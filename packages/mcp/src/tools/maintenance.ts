import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { checkpointAndCopy } from '../db/backup.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const BackupBrainInput = z.object({
  label: z.string().optional(),
});

const GetStatsInput = z.object({
  projectId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// backup_brain
// ---------------------------------------------------------------------------

export interface BackupResult {
  ok: true;
  id: string;
  path: string;
  sizeBytes: number;
}

export function backupBrain(
  db: Database,
  rawInput: unknown,
  backupDir?: string,
): BackupResult {
  const input = BackupBrainInput.parse(rawInput);
  const dir = backupDir ?? join(homedir(), '.agent-brain', 'backups');
  mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = input.label
    ? `${timestamp}-${input.label}.db`
    : `${timestamp}.db`;
  const destPath = join(dir, filename);

  const sizeBytes = checkpointAndCopy(db, destPath);

  return {
    ok: true,
    id: randomUUID(),
    path: destPath,
    sizeBytes,
  };
}

// ---------------------------------------------------------------------------
// get_stats
// ---------------------------------------------------------------------------

interface CountRow { cnt: number }

export interface Stats {
  projects: number;
  dbSizeBytes: number;
}

export function getStats(db: Database, rawInput: unknown): Stats {
  GetStatsInput.parse(rawInput);

  const projectCount = (
    db.prepare('SELECT COUNT(*) AS cnt FROM projects').get() as CountRow
  ).cnt;

  let dbSizeBytes = 0;
  try {
    if (db.name && db.name !== ':memory:') {
      dbSizeBytes = statSync(db.name).size;
    }
  } catch {
    dbSizeBytes = 0;
  }

  return {
    projects: projectCount,
    dbSizeBytes,
  };
}
