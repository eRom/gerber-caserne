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

describe('AST chunker — fenced code safety', () => {
  it('does not split on # inside fenced code blocks', async () => {
    const md = [
      '## Real Header',
      '',
      '```sql',
      'CREATE TABLE t (',
      '  -- # this comment starts with #',
      '  id INTEGER',
      ');',
      '## also not a header inside code',
      '```',
      '',
      '## Another Real Header',
      '',
      'body',
    ].join('\n');
    const chunks = await chunk(md);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.heading_path).toBe('Real Header');
    expect(chunks[1]!.heading_path).toBe('Another Real Header');
  });

  it('invariant: joining chunk contents reproduces the original (whitespace-normalized equality)', async () => {
    const md = `# A\n\n## B\n\nparagraph\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\n## C\n\nmore`;
    const chunks = await chunk(md);
    const rejoined = chunks.map((c) => c.content).join('\n\n');
    // Strong invariant: the full original content is present after normalization.
    // Using equality (not containment) is critical — containment on substrings gives false-greens
    // when a regression silently drops a section.
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(normalize(rejoined)).toBe(normalize(md));
  });
});
