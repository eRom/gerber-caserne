# Search

The `search` tool performs full-text and/or semantic search over notes and their embedding chunks. It is the primary way to retrieve relevant knowledge from the brain.

---

## search

Search notes and chunks using hybrid, semantic, or fulltext mode.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query, max 500 chars |
| `mode` | `"hybrid"` \| `"semantic"` \| `"fulltext"` | No | Search mode (default: `"hybrid"`) |
| `limit` | number | No | Max results to return (default 10, max 50) |
| `projectId` | string | No | Restrict search to a specific project UUID |
| `kind` | `"atom"` \| `"document"` | No | Filter by note kind |
| `status` | `"draft"` \| `"active"` \| `"archived"` \| `"deprecated"` | No | Filter by note status |
| `source` | `"ai"` \| `"human"` \| `"import"` | No | Filter by note source |
| `tags_any` | string[] | No | Match notes that have at least one of these tags |
| `tags_all` | string[] | No | Match notes that have all of these tags |
| `neighbors` | number | No | Return N surrounding chunks from the same document (0–3, default 0) |

### Search Modes

| Mode | Engine | Best for |
|------|--------|----------|
| `hybrid` | Combines semantic + fulltext scores (RRF fusion) | General use — best default choice |
| `semantic` | E5 embeddings, cosine similarity | Conceptual, fuzzy, or paraphrased queries |
| `fulltext` | FTS5 BM25 | Exact keywords, identifiers, error messages |

### Example

**Request:**
```json
{
  "query": "FTS5 rowid mismatch",
  "mode": "hybrid",
  "limit": 5,
  "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tags_any": ["gotcha", "sqlite"]
}
```

**Response:**
```json
{
  "ok": true,
  "results": [
    {
      "chunkId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "noteId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "noteTitle": "FTS5 rowid collision gotcha",
      "noteKind": "atom",
      "noteStatus": "active",
      "noteTags": ["sqlite", "fts5", "gotcha"],
      "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "content": "When inserting into a contentless FTS5 table, the rowid must match the source table's rowid exactly.",
      "score": 0.94,
      "chunkIndex": 0
    }
  ]
}
```

### Example with neighbors

**Request:**
```json
{
  "query": "chunking strategy for documents",
  "mode": "semantic",
  "neighbors": 2
}
```

**Response:**
```json
{
  "ok": true,
  "results": [
    {
      "chunkId": "d4e5f6a7-b8c9-0123-defa-234567890123",
      "noteId": "e5f6a7b8-c9d0-1234-efab-345678901234",
      "noteTitle": "Document Chunking Architecture",
      "noteKind": "document",
      "content": "## Chunking Strategy\n\nDocuments are split at markdown headings...",
      "score": 0.91,
      "chunkIndex": 3,
      "neighbors": [
        {
          "chunkId": "c3d4e5f6-a7b8-9012-cdef-123456789000",
          "content": "## Overview\n\nThe chunker uses an AST-based approach...",
          "chunkIndex": 2
        },
        {
          "chunkId": "e5f6a7b8-c9d0-1234-efab-345678901111",
          "content": "### Overlap\n\nEach chunk overlaps with adjacent chunks...",
          "chunkIndex": 4
        }
      ]
    }
  ]
}
```

### Notes

- `hybrid` mode is strongly recommended for most queries. It combines the recall of semantic search with the precision of fulltext matching.
- `semantic` mode embeds the query using the same E5 model as the documents (`query:` prefix is added automatically). It handles paraphrased queries well but may miss exact strings.
- `fulltext` mode uses FTS5 BM25 and is best for queries containing identifiers, error codes, or specific phrases.
- `neighbors` expands matched chunks with surrounding context from the same document. Useful when results are mid-document and more context is needed. Values from 1–3 return that many chunks before and after the match.
- Tag filters use `json_each()` SQL — they are applied in the database, not post-filtered.
- Search is scoped to all projects by default. Use `projectId` to restrict results.
