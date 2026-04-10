let cached: Promise<any> | null = null;

export async function getEmbeddingPipeline() {
  if (!cached) {
    cached = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      // @ts-expect-error feature-extraction pipeline has a loose union return type (gotcha 5)
      return await pipeline('feature-extraction', 'Xenova/multilingual-e5-base');
    })();
  }
  return cached;
}
