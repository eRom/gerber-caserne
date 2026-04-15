# Embeddings and Search

Gerber uses local E5 embeddings combined with FTS5 fulltext search. No external API is required.

## Model

Model: `Xenova/multilingual-e5-base` via `@huggingface/transformers`.

- Runs entirely in-process (ONNX runtime via the Transformers.js backend)
- Downloaded on first use and cached in the Hugging Face local cache
- Supports multilingual content
- Output dimensionality: 768

The pipeline is initialized lazily and cached as a module-level singleton in `packages/mcp/src/embeddings/pipeline.ts`:

```typescript
let cached: Promise<any> | null = null;

export async function getEmbeddingPipeline() {
  if (!cached) {
    cached = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      // @ts-expect-error: feature-extraction pipeline has a loose union return type
      return await pipeline('feature-extraction', 'Xenova/multilingual-e5-base');
    })();
  }
  return cached;
}
```

The `@ts-expect-error` comment is intentional — the `pipeline()` return type is a loose union that TypeScript cannot narrow without the cast.

## Preloading

Model loading takes several seconds on first call. To avoid blocking the first search request, the server preloads the embedder as a fire-and-forget task after `server.listen()`:

```typescript
// After listen — non-blocking
import('../embeddings/pipeline.js').then(({ getEmbeddingPipeline }) => {
  getEmbeddingPipeline()
    .then(() => { embedderReady = true; })
    .catch((err) => { console.error('Embedder preload failed:', err.message); });
});
```

The `/health` endpoint exposes `embedderReady` so you can check readiness before the first query.

## E5 Prefix Convention

E5 models require a task-specific prefix. Using the wrong prefix degrades retrieval quality.

| Context | Prefix | Function |
|---------|--------|----------|
| Storing content | `passage:` | `embedPassage(text)` |
| Searching | `query:` | `embedQuery(text)` |

```typescript
// packages/mcp/src/embeddings/embed.ts

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
```

Vectors are L2-normalized (`normalize: true`), so cosine similarity reduces to a dot product.

## Tokenizer

Token counting is done with the same model's tokenizer (`AutoTokenizer.from_pretrained`), also cached as a singleton.

```typescript
export async function countTokens(text: string): Promise<number> {
  const tok = await getTokenizer();
  const encoded = tok.encode('passage: ' + text);
  return encoded.length ?? encoded.input_ids?.length ?? 0;
}
```

Note that the `passage:` prefix (9 characters) is included in the token count. The chunker uses this count to stay within `CHUNK_CONFIG.maxTokens = 450`.

**Testing caveat**: The test suite mocks `@huggingface/transformers` and uses a `chars / 4` approximation instead of the real tokenizer. This can diverge from the real token count for non-ASCII content. If you change `chunking.ts` or `tokenizer.ts`, run the real-tokenizer test before merging:

```bash
pnpm --filter @agent-brain/mcp test:e5
```

## AST-Based Markdown Chunker

The chunker is in `packages/mcp/src/embeddings/chunking.ts`. It parses markdown into an AST using `remark` (not regex), which means:

- `#` inside fenced code blocks is correctly ignored — it is not treated as a heading
- GFM extensions (tables, task lists) are handled via `remark-gfm`
- Round-trip fidelity: the heading node is re-included in the chunk content so the original markdown can be reconstructed

### Chunking algorithm

1. Parse the full document into an AST
2. Walk top-level nodes
3. On each heading with depth ≤ `CHUNK_CONFIG.maxDepth` (default: 3), flush the accumulated nodes as a chunk
4. Track heading breadcrumbs in a stack → `heading_path` (e.g. `"Introduction > Installation"`)
5. If a section exceeds `maxTokens` (450), split recursively:
   - First: split by double-newline (paragraphs)
   - Fallback: split by sentence (`(?<=[.!?])\s+`)

### Configuration

```typescript
// packages/mcp/src/config.ts
export const CHUNK_CONFIG = {
  strategy: 'ast-header-split',
  maxTokens: 450,
  maxDepth: 3,   // split on H1, H2, H3 — H4+ are not split boundaries
  version: 1,
};
```

### ChunkResult shape

```typescript
interface ChunkResult {
  position: number;       // 0-based index within the note
  heading_path: string;   // "Parent > Child > Section"
  content: string;        // Full chunk text (includes the heading)
  content_hash: string;   // SHA-256 of content
}
```

## Search Pipeline

### Fulltext Search (FTS5)

`packages/mcp/src/search/fulltext.ts`

1. Sanitize the query — strip FTS5 special characters to prevent syntax errors, preserve `OR`/`AND`/`NOT`
2. Run `notes_fts MATCH ?` with `bm25(notes_fts)` scoring
3. JOIN with `fts_source` to resolve `(source_type, source_id)` for each rowid
4. Overfetch candidates (`limit * 3`), then apply metadata filters (project, kind, status, source, tags) in JS
5. Return `FulltextHit[]` with BM25 score and a snippet

Note: BM25 scores from FTS5 are negative (lower = better match). The implementation negates them (`score = -row.score`) to produce positive values for consistent fusion.

### Semantic Search

`packages/mcp/src/search/semantic.ts`

1. Embed the query with `embedQuery()` (`query:` prefix)
2. Build a SQL query against `embedding_owners` view with pre-filters (project, kind, status, source, tags via `json_each()`)
3. Load all matching vectors as `Float32Array`
4. Compute dot product against the query vector (equivalent to cosine similarity since vectors are normalized)
5. Filter out non-positive scores, sort descending, return top N with snippets

### Hybrid Search (RRF)

`packages/mcp/src/search/hybrid.ts`

Runs FTS5 and semantic search in parallel, then fuses the results using **Reciprocal Rank Fusion (RRF)**:

```
score(doc, rank) = 1 / (k + rank + 1)    where k = 60
```

For each document, scores from both rankings are summed:

```
final_score = rrf_fts(rank_fts) + rrf_sem(rank_sem)
```

A document appearing in both result sets gets a combined score that rewards consistent relevance across both signals. Documents appearing in only one list still contribute their single-source RRF score.

The implementation:

```typescript
const RRF_K = 60;  // Standard default

ftsHits.forEach((hit, rank) => {
  entry.scoreFts = 1 / (RRF_K + rank + 1);
  entry.rrfScore += entry.scoreFts;
});

semHits.forEach((hit, rank) => {
  entry.scoreSem = 1 / (RRF_K + rank + 1);
  entry.rrfScore += entry.scoreSem;
});
```

Both searches overfetch to `Math.max(limit * 3, 60)` candidates before fusion. The final list is sliced to `limit` after sorting by `rrfScore` descending.

The `HybridHit` type exposes all three scores (`score`, `scoreFts`, `scoreSem`) so callers can inspect the contribution of each signal.
