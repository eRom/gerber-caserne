let cached: any;

export async function getTokenizer() {
  if (!cached) {
    const { AutoTokenizer } = await import('@huggingface/transformers');
    cached = await AutoTokenizer.from_pretrained('Xenova/multilingual-e5-base');
  }
  return cached;
}

export async function countTokens(text: string): Promise<number> {
  const tok = await getTokenizer();
  const encoded = tok.encode('passage: ' + text);
  return encoded.length ?? encoded.input_ids?.length ?? 0;
}
