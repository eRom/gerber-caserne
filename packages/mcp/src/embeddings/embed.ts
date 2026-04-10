import { getEmbeddingPipeline } from './pipeline.js';

export async function embedPassage(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline();
  const result = await pipe('passage: ' + text, { pooling: 'mean', normalize: true });
  return new Float32Array(result.data);
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline();
  const result = await pipe('query: ' + text, { pooling: 'mean', normalize: true });
  return new Float32Array(result.data);
}
