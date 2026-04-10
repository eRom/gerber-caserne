import type { Database } from 'better-sqlite3';
import { chunk } from '../embeddings/chunking.js';
import { embedPassage } from '../embeddings/embed.js';
import { sha256 } from '../db/hash.js';

interface ExistingChunk {
  id: string;
  note_id: string;
  position: number;
  heading_path: string;
  content: string;
  content_hash: string;
  created_at: number;
}

/**
 * Diff-based chunk sync: unchanged chunks (same content_hash) keep their UUID
 * and embedding. Only changed/new chunks get new embeddings.
 */
export async function syncDocumentChunks(
  db: Database,
  noteId: string,
  newContent: string,
): Promise<void> {
  // 1. Chunk the new content
  const newChunks = await chunk(newContent);

  // 2. Load existing chunks
  const existingChunks = db
    .prepare('SELECT * FROM chunks WHERE note_id = ? ORDER BY position')
    .all(noteId) as ExistingChunk[];

  // 3. Build map: content_hash -> existing chunk (for reuse detection)
  const existingByHash = new Map<string, ExistingChunk>();
  for (const ec of existingChunks) {
    existingByHash.set(ec.content_hash, ec);
  }

  // 4. For each new chunk, decide: reuse or create
  // Compute embeddings for NEW chunks BEFORE the transaction (async boundary)
  const prepared: Array<{
    action: 'reuse' | 'create';
    chunkId: string;
    position: number;
    heading_path: string;
    content: string;
    content_hash: string;
    vec?: Float32Array;
    positionChanged?: boolean;
    headingChanged?: boolean;
  }> = [];

  for (let i = 0; i < newChunks.length; i++) {
    const nc = newChunks[i]!;
    const existing = existingByHash.get(nc.content_hash);

    if (existing) {
      // Reuse: preserve UUID, no new embedding
      existingByHash.delete(nc.content_hash); // mark as consumed
      prepared.push({
        action: 'reuse',
        chunkId: existing.id,
        position: i,
        heading_path: nc.heading_path,
        content: nc.content,
        content_hash: nc.content_hash,
        positionChanged: existing.position !== i,
        headingChanged: existing.heading_path !== nc.heading_path,
      });
    } else {
      // New chunk: need embedding
      prepared.push({
        action: 'create',
        chunkId: crypto.randomUUID(),
        position: i,
        heading_path: nc.heading_path,
        content: nc.content,
        content_hash: nc.content_hash,
      });
    }
  }

  // Compute embeddings for all new chunks (outside transaction)
  await Promise.all(
    prepared
      .filter((p) => p.action === 'create')
      .map(async (p) => {
        p.vec = await embedPassage(p.content);
      }),
  );

  // 5. All DB mutations in a single transaction
  const contentHash = sha256(newContent);
  const now = Date.now();

  db.transaction(() => {
    // Delete stale chunks (remaining in existingByHash = no longer present)
    // The chunks_ad_emb trigger will clean up their embeddings
    for (const stale of existingByHash.values()) {
      db.prepare('DELETE FROM chunks WHERE id = ?').run(stale.id);
    }

    // Process each prepared chunk
    for (const p of prepared) {
      if (p.action === 'reuse') {
        // Update position/heading if changed
        if (p.positionChanged || p.headingChanged) {
          db.prepare(
            'UPDATE chunks SET position = ?, heading_path = ? WHERE id = ?',
          ).run(p.position, p.heading_path, p.chunkId);
        }
      } else {
        // Insert new chunk
        db.prepare(
          `INSERT INTO chunks (id, note_id, position, heading_path, content, content_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(p.chunkId, noteId, p.position, p.heading_path, p.content, p.content_hash, now);

        // Insert embedding
        const vecBuffer = Buffer.from(p.vec!.buffer, p.vec!.byteOffset, p.vec!.byteLength);
        db.prepare(
          `INSERT INTO embeddings (owner_type, owner_id, model, dim, vector, content_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run('chunk', p.chunkId, 'Xenova/multilingual-e5-base', 768, vecBuffer, p.content_hash, now);
      }
    }

    // 6. Update note's content and content_hash
    db.prepare(
      'UPDATE notes SET content = ?, content_hash = ?, updated_at = ? WHERE id = ?',
    ).run(newContent, contentHash, now, noteId);
  })();
}
