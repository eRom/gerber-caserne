import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { freshDb } from '../_helpers/fresh-db.js';
import { getMeta, setMeta, checkChunkConfigVersion, markChunkConfigReindexed } from '../../db/app-meta.js';

describe('app_meta', () => {
  let db: any;
  let close: () => void;

  beforeEach(() => ({ db, close } = freshDb()));
  afterEach(() => close());

  it('getMeta returns undefined for missing key', () => {
    expect(getMeta(db, 'nonexistent')).toBeUndefined();
  });

  it('setMeta / getMeta round-trip', () => {
    setMeta(db, 'foo', 'bar');
    expect(getMeta(db, 'foo')).toBe('bar');
  });

  it('fresh DB has chunk_config_version after migrations', () => {
    // applyMigrations is called by freshDb, which should init the version
    checkChunkConfigVersion(db);
    expect(getMeta(db, 'chunk_config_version')).toBe('1');
  });

  it('warns when config version differs', () => {
    setMeta(db, 'chunk_config_version', '99');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    checkChunkConfigVersion(db);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('chunk config changed'));
    warnSpy.mockRestore();
  });

  it('markChunkConfigReindexed updates the stored version', () => {
    markChunkConfigReindexed(db, 2);
    expect(getMeta(db, 'chunk_config_version')).toBe('2');
  });
});
