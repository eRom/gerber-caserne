import { describe, it, expect } from 'vitest';
import { embedPassage, embedQuery } from '../../embeddings/embed.js';

describe('embed', () => {
  it('embedPassage returns a 768-d L2-normalized vector', async () => {
    const v = await embedPassage('hello');
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(768);
    const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
  it('embedPassage and embedQuery produce different vectors for the same text', async () => {
    const p = await embedPassage('hello');
    const q = await embedQuery('hello');
    // passage: vs query: prefixes → different inputs → different mock outputs
    let dot = 0;
    for (let i = 0; i < 768; i++) dot += p[i]! * q[i]!;
    expect(dot).toBeLessThan(0.999);
  });
});
