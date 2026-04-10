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

interface KindRow { kind: string; cnt: number }
interface StatusRow { status: string; cnt: number }
interface SourceRow { source: string; cnt: number }
interface EmbeddingOwnerRow { owner_type: string; cnt: number }
interface TagRow { tag: string; count: number }
interface AvgChunksRow { avg_chunks: number | null }

export interface Stats {
  projects: number;
  notes: {
    total: number;
    byKind: Record<string, number>;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  };
  chunks: {
    total: number;
    avgPerDoc: number;
  };
  embeddings: {
    total: number;
    byOwnerType: Record<string, number>;
    model: string;
  };
  dbSizeBytes: number;
  topTags: Array<{ tag: string; count: number }>;
}

export function getStats(db: Database, rawInput: unknown): Stats {
  const input = GetStatsInput.parse(rawInput);

  // Build optional WHERE clause for project-scoped queries
  const projectWhere = input.projectId
    ? `WHERE project_id = '${input.projectId}'`
    : '';

  // Projects count
  const projectCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }
  ).cnt;

  // Notes totals
  const noteTotal = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM notes ${projectWhere}`)
      .get() as { cnt: number }
  ).cnt;

  const notesByKind = db
    .prepare(`SELECT kind, COUNT(*) as cnt FROM notes ${projectWhere} GROUP BY kind`)
    .all() as KindRow[];

  const notesByStatus = db
    .prepare(`SELECT status, COUNT(*) as cnt FROM notes ${projectWhere} GROUP BY status`)
    .all() as StatusRow[];

  const notesBySource = db
    .prepare(`SELECT source, COUNT(*) as cnt FROM notes ${projectWhere} GROUP BY source`)
    .all() as SourceRow[];

  // Chunks
  const chunkTotal = (
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM chunks${
          input.projectId
            ? ` WHERE note_id IN (SELECT id FROM notes WHERE project_id = '${input.projectId}')`
            : ''
        }`,
      )
      .get() as { cnt: number }
  ).cnt;

  const avgRow = db
    .prepare(
      `SELECT AVG(c) as avg_chunks FROM (SELECT COUNT(*) as c FROM chunks${
        input.projectId
          ? ` WHERE note_id IN (SELECT id FROM notes WHERE project_id = '${input.projectId}')`
          : ''
      } GROUP BY note_id)`,
    )
    .get() as AvgChunksRow;

  // Embeddings
  const embTotal = (
    db.prepare('SELECT COUNT(*) as cnt FROM embeddings').get() as { cnt: number }
  ).cnt;

  const embByOwnerType = db
    .prepare('SELECT owner_type, COUNT(*) as cnt FROM embeddings GROUP BY owner_type')
    .all() as EmbeddingOwnerRow[];

  // Model: pick from any embedding row, fallback to known constant
  const modelRow = db
    .prepare("SELECT model FROM embeddings LIMIT 1")
    .get() as { model: string } | undefined;
  const embModel = modelRow?.model ?? 'Xenova/multilingual-e5-base';

  // Top tags — JSON array stored as string in notes.tags
  const topTags = db
    .prepare(
      `SELECT value as tag, COUNT(*) as count
       FROM notes${projectWhere ? ` ${projectWhere},` : ','} json_each(notes.tags)
       GROUP BY value
       ORDER BY count DESC
       LIMIT 20`,
    )
    .all() as TagRow[];

  // DB size
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
    notes: {
      total: noteTotal,
      byKind: Object.fromEntries(notesByKind.map((r) => [r.kind, r.cnt])),
      byStatus: Object.fromEntries(notesByStatus.map((r) => [r.status, r.cnt])),
      bySource: Object.fromEntries(notesBySource.map((r) => [r.source, r.cnt])),
    },
    chunks: {
      total: chunkTotal,
      avgPerDoc: avgRow.avg_chunks ?? 0,
    },
    embeddings: {
      total: embTotal,
      byOwnerType: Object.fromEntries(embByOwnerType.map((r) => [r.owner_type, r.cnt])),
      model: embModel,
    },
    dbSizeBytes,
    topTags,
  };
}
