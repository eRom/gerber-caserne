import { vi } from 'vitest';
import { mockEmbed } from './_helpers/mock-embeddings.js';

vi.mock('@huggingface/transformers', () => {
  const pipeline = vi.fn(async () => {
    const fn = async (text: string) => ({ data: mockEmbed(text) });
    return Object.assign(fn, {
      tokenizer: {
        encode: (t: string) => ({ length: Math.ceil(t.length / 4) }),
      },
    });
  });
  const AutoTokenizer = {
    from_pretrained: vi.fn(async () => ({
      encode: (t: string) => ({ length: Math.ceil(t.length / 4) }),
    })),
  };
  return { pipeline, AutoTokenizer };
});
