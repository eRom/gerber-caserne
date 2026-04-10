import { openDatabase } from '../db/index.js';
import { applyMigrations } from '../db/migrate.js';
import { syncDocumentChunks } from '../notes/sync-chunks.js';
import { markChunkConfigReindexed } from '../db/app-meta.js';
import { CHUNK_CONFIG } from '../config.js';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export async function reindex(dbPath: string): Promise<void> {
  const db = openDatabase(dbPath);
  applyMigrations(db);

  // Get all documents
  const docs = db.prepare("SELECT id, content FROM notes WHERE kind = 'document'").all() as { id: string; content: string }[];

  console.log(`Reindexing ${docs.length} documents with chunk config v${CHUNK_CONFIG.version}...`);

  for (const doc of docs) {
    console.log(`  Reindexing document ${doc.id}...`);
    await syncDocumentChunks(db, doc.id, doc.content);
  }

  // Mark reindex as complete
  markChunkConfigReindexed(db, CHUNK_CONFIG.version);

  console.log('Reindex complete.');
  db.close();
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') ?? '')) {
  const dbFlag = process.argv.indexOf('--db-path');
  const dbPath = dbFlag >= 0 ? process.argv[dbFlag + 1]! : resolve(homedir(), '.agent-brain', 'brain.db');
  reindex(dbPath).catch(err => {
    console.error('Reindex failed:', err.message);
    process.exit(1);
  });
}
