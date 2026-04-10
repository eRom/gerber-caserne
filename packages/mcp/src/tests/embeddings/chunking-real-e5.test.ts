import { describe, it, expect, vi } from 'vitest';
import { chunk } from '../../embeddings/chunking.js';

// Unmock the HF transformers module so this file uses the real E5 tokenizer.
vi.unmock('@huggingface/transformers');

const runInCi = process.env.CI === 'true';

describe.skipIf(runInCi)('chunker — real E5 tokenizer', () => {
  it('every chunk is <= 450 tokens under the real E5 tokenizer', async () => {
    // French-heavy sample — representative of real agent-brain content.
    const md = [
      '# ADN Barda',
      '',
      '## Section 1 — Stack',
      'Node.js 20, TypeScript strict, Drizzle, FTS5. '.repeat(40),
      '',
      '## Section 2 — Embeddings',
      'Le modèle multilingue E5-base encode chaque passage avec un préfixe obligatoire. '.repeat(50),
      '',
      '## Section 3 — Chunking',
      'Paragraphe 1 sur le chunking.\n\nParagraphe 2 sur le chunking.\n\nParagraphe 3.'.repeat(10),
    ].join('\n');

    const chunks = await chunk(md);
    const { AutoTokenizer } = await import('@huggingface/transformers');
    const tokenizer = await AutoTokenizer.from_pretrained('Xenova/multilingual-e5-base');

    for (const c of chunks) {
      const encoded = tokenizer.encode('passage: ' + c.content);
      const len = (encoded as any).length ?? (encoded as any).input_ids?.length ?? 0;
      expect(len, `chunk at position ${c.position} (${c.heading_path})`).toBeLessThanOrEqual(450);
    }
  }, 30_000); // 30s timeout — first run downloads the ~200MB model.
});
