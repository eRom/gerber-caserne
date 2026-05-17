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
interface GroupCountRow { key: string; cnt: number }

export interface Stats {
  projects: number;
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
  issues: {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  messages: {
    total: number;
    byStatus: Record<string, number>;
  };
  handoffs: {
    total: number;
    byStatus: Record<string, number>;
  };
  dbSizeBytes: number;
}

function groupCount(
  db: Database,
  table: string,
  column: string,
  projectFilter: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT ${column} AS key, COUNT(*) AS cnt FROM ${table} ${projectFilter} GROUP BY ${column}`,
    )
    .all() as GroupCountRow[];
  return Object.fromEntries(rows.map((r) => [r.key, r.cnt]));
}

export function getStats(db: Database, rawInput: unknown): Stats {
  const input = GetStatsInput.parse(rawInput);

  // Build optional WHERE clause for project-scoped queries.
  // Safe to inline: projectId is validated as a UUID by Zod above.
  const projectFilter = input.projectId
    ? `WHERE project_id = '${input.projectId}'`
    : '';

  const projectCount = (
    db.prepare('SELECT COUNT(*) AS cnt FROM projects').get() as CountRow
  ).cnt;

  const tasksTotal = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM tasks ${projectFilter}`).get() as CountRow
  ).cnt;

  const issuesTotal = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM issues ${projectFilter}`).get() as CountRow
  ).cnt;

  const messagesTotal = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM messages ${projectFilter}`).get() as CountRow
  ).cnt;

  // Handoffs are not scoped to a project.
  const handoffsTotal = (
    db.prepare('SELECT COUNT(*) AS cnt FROM handoffs').get() as CountRow
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
    tasks: {
      total: tasksTotal,
      byStatus: groupCount(db, 'tasks', 'status', projectFilter),
      byPriority: groupCount(db, 'tasks', 'priority', projectFilter),
    },
    issues: {
      total: issuesTotal,
      byStatus: groupCount(db, 'issues', 'status', projectFilter),
      bySeverity: groupCount(db, 'issues', 'severity', projectFilter),
    },
    messages: {
      total: messagesTotal,
      byStatus: groupCount(db, 'messages', 'status', projectFilter),
    },
    handoffs: {
      total: handoffsTotal,
      byStatus: groupCount(db, 'handoffs', 'status', ''),
    },
    dbSizeBytes,
  };
}
