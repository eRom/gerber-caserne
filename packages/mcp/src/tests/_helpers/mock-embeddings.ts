import { createHash } from 'node:crypto';

export function mockEmbed(text: string): Float32Array {
  const hash = createHash('sha256').update(text).digest();
  const vec = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    // Use hash bytes cyclically as seed for each dimension
    vec[i] = (hash[i % 32]! + i * 0.001) / 256 - 0.5;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < 768; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm);
  for (let i = 0; i < 768; i++) vec[i]! /= norm;
  return vec;
}
