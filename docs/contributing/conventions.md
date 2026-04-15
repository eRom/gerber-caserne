# Coding Conventions

## Express 5

Use `await import()` for dynamic imports. `require()` is not supported in Express 5 context.

## Response Shapes

All tool handlers must return shapes that match the Zod envelopes defined in `packages/mcp/src/tools/contracts.ts`. Contract tests validate this automatically — do not bypass them.

## camelCase / snake_case Mapping

- Drizzle ORM returns **camelCase** properties
- SQLite columns use **snake_case**

Always map raw SQLite rows through the dedicated helper functions: `toProject()`, `toNote()`, `toTask()`, etc. Never pass raw DB rows directly to a response.

## Tags Filtering

Use `json_each()` in SQL `WHERE` clauses for tag filtering. Never post-filter tags in JavaScript — let the database handle it.

```sql
-- Correct
WHERE EXISTS (
  SELECT 1 FROM json_each(notes.tags) WHERE value = ?
)
```

## E5 Embeddings

- Prefix all indexed content with `passage:` when inserting into the vector store
- Prefix all search queries with `query:` when performing semantic search
- Token counts include the 9-character prefix — account for 9 extra tokens per string

## SQLite Pragmas

Order matters. Always set WAL first, then `busy_timeout`:

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

`busy_timeout = 5000` prevents `SQLITE_BUSY` errors on concurrent access.

## AST Chunker

The markdown chunker (`packages/mcp/src/embeddings/chunking.ts`) uses AST parsing, not regex. A `#` character inside a fenced code block is **not** treated as a heading. Do not replace it with a regex-based approach.

## Routes

| Route | Purpose |
|-------|---------|
| `/mcp` | JSON-RPC bridge for the Web UI |
| `/mcp/stream` | Official MCP Streamable HTTP transport for Managed Agents |

These are separate routes with different protocols and lifecycles. Do not merge them.

## Dependencies

- Pin `devDependency` versions — no `^` or `~` ranges
- Use `pnpm` exclusively — not npm or yarn

## Mock Tokenizer

Tests use a mock tokenizer (chars / 4 approximation). This may diverge from the real E5 tokenizer. Before merging any changes to `embeddings/chunking.ts` or `embeddings/tokenizer.ts`, run the real-model test suite locally:

```bash
pnpm --filter @agent-brain/mcp test:e5
```

This downloads the actual E5 model and validates chunking behavior end-to-end.
