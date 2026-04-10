import { describe, it, expect } from 'vitest';
import { mockEmbed } from '../_helpers/mock-embeddings.js';

describe('mockEmbed', () => {
  it('returns a 768-d Float32Array', () => {
    const v = mockEmbed('hello');
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(768);
  });

  it('is deterministic', () => {
    const a = mockEmbed('test');
    const b = mockEmbed('test');
    expect(a).toEqual(b);
  });

  it('is L2-normalized (dot product with self ≈ 1)', () => {
    const v = mockEmbed('anything');
    let dot = 0;
    for (let i = 0; i < 768; i++) dot += v[i]! * v[i]!;
    expect(dot).toBeCloseTo(1, 5);
  });

  it('different inputs produce different vectors', () => {
    const a = mockEmbed('hello');
    const b = mockEmbed('world');
    let dot = 0;
    for (let i = 0; i < 768; i++) dot += a[i]! * b[i]!;
    expect(dot).toBeLessThan(0.999);
  });
});
