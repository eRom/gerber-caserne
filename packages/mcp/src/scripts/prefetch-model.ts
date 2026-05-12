#!/usr/bin/env node
/**
 * Pre-fetch the E5 embedding model into the HuggingFace cache.
 * Run at Docker build time so the resulting image is self-contained
 * and doesn't need network access at boot.
 *
 * Model: Xenova/multilingual-e5-base (must match embeddings/pipeline.ts)
 */
import { pipeline } from '@huggingface/transformers';

async function main() {
  console.log('Pre-fetching E5 model (Xenova/multilingual-e5-base)...');
  await pipeline('feature-extraction', 'Xenova/multilingual-e5-base');
  console.log('E5 model cached.');
}

main().catch((err) => {
  console.error('prefetch-model failed:', err);
  process.exit(1);
});
