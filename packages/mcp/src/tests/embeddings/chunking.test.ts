import { describe, it, expect } from 'vitest';
import { chunk } from '../../embeddings/chunking.js';

describe('AST chunker — happy path', () => {
  it('splits a simple doc by H2 headers', async () => {
    const md = `# Title\n\n## Alpha\n\nAlpha body.\n\n## Beta\n\nBeta body.`;
    const chunks = await chunk(md);
    expect(chunks).toHaveLength(3); // Title intro + Alpha + Beta
    expect(chunks[0]!.heading_path).toBe('Title');
    expect(chunks[1]!.heading_path).toBe('Title > Alpha');
    expect(chunks[2]!.heading_path).toBe('Title > Beta');
    chunks.forEach((c, i) => expect(c.position).toBe(i));
  });
});
