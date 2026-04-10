import { describe, it, expect } from 'vitest';
import { openDatabase } from '../../db/index.js';
import { applyMigrations } from '../../db/migrate.js';

describe('triggers', () => {
  it('registers the 8 expected triggers', () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'notes_ai_fts', 'notes_au_fts', 'notes_ad_fts',
        'chunks_ai_fts', 'chunks_au_fts', 'chunks_ad_fts',
        'notes_ad_emb', 'chunks_ad_emb',
      ]),
    );
  });
});
