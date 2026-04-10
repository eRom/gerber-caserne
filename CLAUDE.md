# CLAUDE.md — agent-brain

## Project Structure

Monorepo with pnpm workspaces:
- `packages/shared/` — Pure TypeScript, no native deps. Drizzle schema + Zod types.
- `packages/mcp/` — MCP server with better-sqlite3, E5 embeddings, Express 5.

## Key Commands

```bash
pnpm install              # Install deps
pnpm build                # Build MCP package
pnpm test                 # Run all tests
pnpm typecheck            # Type-check
pnpm mcp:restore <path>   # Restore DB from backup
pnpm mcp:reindex           # Re-chunk all documents
```

## Gotchas

| # | Gotcha | Where |
|---|--------|-------|
| 1 | Express 5 requires `await import()` — no require() | `http/server.ts` |
| 2 | Response shapes must match Zod envelopes | `tools/contracts.ts` |
| 3 | camelCase ↔ snake_case: Drizzle returns camelCase, SQLite columns are snake_case. Always map raw rows via `toProject()`/`toNote()` helpers | All tool handlers |
| 4 | Backup: checkpoint WAL before copy | `db/backup.ts` |
| 5 | `pipeline()` return type is a loose union — `@ts-expect-error` required | `embeddings/pipeline.ts` |
| 6 | Tests: `vi.mock('@huggingface/transformers')` in setup.ts prevents model download | `tests/setup.ts` |
| 7 | Tags filter uses `json_each()` in SQL WHERE — never post-filter in JS | `tools/notes.ts`, `search/*.ts` |
| 8 | E5 requires `passage:` / `query:` prefixes | `embeddings/embed.ts` |
| 9 | Token count includes the prefix (9 extra chars) | `embeddings/tokenizer.ts` |
| 10 | Pragma order matters: WAL first, then busy_timeout | `db/index.ts` |
| 11 | `busy_timeout = 5000` prevents SQLITE_BUSY on concurrent access | `db/index.ts` |
| 12 | Mock tokenizer (chars/4) may diverge from real E5 tokenizer — run `pnpm --filter @agent-brain/mcp test:e5` before merging changes to chunking | `tests/embeddings/chunking-real-e5.test.ts` |
| 13 | Embedder preload: fire-and-forget after server.listen | `http/server.ts` |
| 14 | AST chunker (not regex) — `#` inside fenced code blocks is not a header | `embeddings/chunking.ts` |

## Pre-merge Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] If touching `embeddings/chunking.ts` or `embeddings/tokenizer.ts`: run `pnpm --filter @agent-brain/mcp test:e5` locally
- [ ] `pnpm build` succeeds
