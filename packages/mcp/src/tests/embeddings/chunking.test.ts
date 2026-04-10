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

  it('splits oversized sections into sub-chunks ≤ 450 tokens', async () => {
    // Mock tokenizer counts chars/4, so 450 tokens = 1800 chars.
    // Create a section with ~2500 chars (>450 tokens with mock).
    const longParagraphs = Array.from({ length: 15 }, (_, i) =>
      `Paragraph ${i}: ${'x'.repeat(150)}.`
    ).join('\n\n');
    const md = `## Long Section\n\n${longParagraphs}`;
    const chunks = await chunk(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // All chunks should be at most 450 mock-tokens
    for (const c of chunks) {
      // Mock: Math.ceil(text.length / 4)
      // But countTokens adds 'passage: ' prefix (9 chars), so effective limit on content is lower
      expect(Math.ceil(('passage: ' + c.content).length / 4)).toBeLessThanOrEqual(450);
    }
  });

  it('fuzz: 20 random docs all produce chunks ≤ 450 tokens', async () => {
    for (let trial = 0; trial < 20; trial++) {
      const sections = Array.from({ length: 3 + Math.floor(Math.random() * 5) }, (_, i) => {
        const bodyLength = 100 + Math.floor(Math.random() * 3000);
        const body = Array.from({ length: Math.ceil(bodyLength / 100) }, (_, j) =>
          `Sentence ${j} of section ${i}. ${'word '.repeat(10 + Math.floor(Math.random() * 30))}`
        ).join('\n\n');
        return `## Section ${i}\n\n${body}`;
      });
      const md = `# Doc ${trial}\n\n${sections.join('\n\n')}`;
      const chunks = await chunk(md);
      for (const c of chunks) {
        const tokenCount = Math.ceil(('passage: ' + c.content).length / 4);
        expect(tokenCount, `Trial ${trial}, chunk pos ${c.position} (${c.heading_path})`).toBeLessThanOrEqual(450);
      }
    }
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
