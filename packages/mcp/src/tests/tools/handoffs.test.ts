import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import { freshDb } from '../_helpers/fresh-db.js';
import {
  handoffCreate,
  handoffList,
  handoffGet,
  handoffClose,
} from '../../tools/handoffs.js';

describe('handoff tools', () => {
  let db: Database;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = freshDb());
  });
  afterEach(() => close());

  // ---------------------------------------------------------------------------
  // handoffCreate
  // ---------------------------------------------------------------------------

  describe('handoffCreate', () => {
    it('creates a handoff with defaults (status=inbox, empty content)', () => {
      const result = handoffCreate(db, { title: 'Passage spec paiement' });

      expect(result.ok).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.item.title).toBe('Passage spec paiement');
      expect(result.item.content).toBe('');
      expect(result.item.status).toBe('inbox');
      expect(result.item.createdAt).toBeGreaterThan(0);
    });

    it('creates a handoff with all fields', () => {
      const result = handoffCreate(db, {
        title: 'Idéation dashboard',
        content: '## TL;DR\nbrainstorm sur la home',
        status: 'inbox',
      });

      expect(result.item.content).toContain('brainstorm');
    });

    it('rejects empty title', () => {
      expect(() => handoffCreate(db, { title: '' })).toThrow();
    });

    it('rejects invalid status', () => {
      expect(() =>
        handoffCreate(db, { title: 'X', status: 'weird' as any }),
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // handoffList
  // ---------------------------------------------------------------------------

  describe('handoffList', () => {
    it('returns all handoffs when no filter', () => {
      handoffCreate(db, { title: 'A' });
      handoffCreate(db, { title: 'B' });

      const result = handoffList(db, {});
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by status=inbox', () => {
      handoffCreate(db, { title: 'pending' });
      const c = handoffCreate(db, { title: 'toClose' });
      handoffClose(db, { id: c.id });

      const result = handoffList(db, { status: 'inbox' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe('pending');
    });

    it('filters by status=done', () => {
      handoffCreate(db, { title: 'pending' });
      const c = handoffCreate(db, { title: 'toClose' });
      handoffClose(db, { id: c.id });

      const result = handoffList(db, { status: 'done' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe('toClose');
    });

    it('orders by createdAt DESC', () => {
      const first = handoffCreate(db, { title: 'First' });
      db.prepare('UPDATE handoffs SET created_at = created_at - 1 WHERE id = ?').run(first.id);
      handoffCreate(db, { title: 'Second' });

      const result = handoffList(db, {});
      expect(result.items[0]!.title).toBe('Second');
      expect(result.items[1]!.title).toBe('First');
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) handoffCreate(db, { title: `H${i}` });

      const result = handoffList(db, { limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // handoffGet
  // ---------------------------------------------------------------------------

  describe('handoffGet', () => {
    it('returns a handoff by id', () => {
      const { id } = handoffCreate(db, { title: 'T', content: 'body' });

      const result = handoffGet(db, { id });
      expect(result.item.id).toBe(id);
      expect(result.item.content).toBe('body');
    });

    it('returns a handoff by title', () => {
      handoffCreate(db, { title: 'Uniq title', content: 'match me' });

      const result = handoffGet(db, { title: 'Uniq title' });
      expect(result.item.content).toBe('match me');
    });

    it('on title collision returns the most recent', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const old = handoffCreate(db, { title: 'Same', content: 'old' });
      // Push the first one into the past to guarantee a distinct ordering.
      db.prepare('UPDATE handoffs SET created_at = created_at - 10 WHERE id = ?').run(old.id);
      handoffCreate(db, { title: 'Same', content: 'new' });

      const result = handoffGet(db, { title: 'Same' });
      expect(result.item.content).toBe('new');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('throws when neither id nor title is provided', () => {
      expect(() => handoffGet(db, {})).toThrow();
    });

    it('throws on not found (by id)', () => {
      expect(() =>
        handoffGet(db, { id: '00000000-0000-0000-0000-000000000001' }),
      ).toThrow(/not found/i);
    });

    it('throws on not found (by title)', () => {
      expect(() => handoffGet(db, { title: 'nope' })).toThrow(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // handoffClose
  // ---------------------------------------------------------------------------

  describe('handoffClose', () => {
    it('sets status to done by id', () => {
      const { id } = handoffCreate(db, { title: 'Open' });
      const result = handoffClose(db, { id });

      expect(result.ok).toBe(true);
      expect(result.id).toBe(id);
      expect(result.item.status).toBe('done');
    });

    it('sets status to done by title', () => {
      handoffCreate(db, { title: 'By title' });
      const result = handoffClose(db, { title: 'By title' });

      expect(result.item.status).toBe('done');
    });

    it('is idempotent on an already-done handoff', () => {
      const { id } = handoffCreate(db, { title: 'X' });
      handoffClose(db, { id });
      const result = handoffClose(db, { id });

      expect(result.item.status).toBe('done');
    });

    it('throws on not found', () => {
      expect(() =>
        handoffClose(db, { id: '00000000-0000-0000-0000-000000000001' }),
      ).toThrow(/not found/i);
    });
  });
});
