# Changelog

All notable changes to this project will be documented in this file.

## [2.4.0] - 2026-05-17

### Breaking
- Drop handoffs from the MCP server (migration 0008). Handoffs now live in Linear (workspace eRom, projet Handoffs, label `handoff`). Mapping `inbox → Todo`, `done → Done`. No data migration.
- Drop tasks + issues from the MCP server (migration 0007). Tasks/issues now live in Linear (workspace eRom, team eRom-Agents). 109 entities migrated (range EAT-61 → EAT-169).

### Security
- Bump drizzle-orm to 0.45.4, drizzle-zod to 0.7.1, drizzle-kit to 0.30.6 to clear CVE GHSA-gpj5-g38j-94v9 (SQL injection via improperly escaped identifiers). No applicative code change required — `createSelectSchema` and the `sqliteTable` DSL are backwards-compatible.

## [2.3.1] - 2026-05-17

### Security
- Force `fast-uri >= 3.1.2` via `pnpm.overrides` to clear GHSA-q3j6-qgpj-74h6 (path traversal) and GHSA-v39h-62p7-jpjc (host confusion). Transitive via `@modelcontextprotocol/sdk → ajv → fast-uri`.

### Breaking
- **Drop the notes / chunks / embeddings / FTS5 / search subsystem from the MCP server.** Knowledge memory is now delegated to the Gemini vault RAG (`eRom/gerber-vault`) reached via the existing `rag` MCP tool. Migration `0006_drop_notes.sql` removes the underlying tables (`notes`, `chunks`, `embeddings`, `notes_fts`, `fts_source`, `embedding_owners`, `app_meta`) and their triggers — irreversible on existing databases.
- Remove the legacy JSON-RPC bridge on `/mcp`. `/mcp/stream` is now the only HTTP transport.
- Drop frontends `packages/ui/` (Vite/React SPA) and `packages/tui/` (Ink TUI). `packages/admin/` (Rust launcher for MCP + cloudflared) is kept.
- Remove dead `agents/agent-vault` sub-agent. The vault archival role is handled by the `pull-sources.yml` workflow on `eRom/gerber-vault` (cron 15min).

### Removed
- MCP tools: `note_create`, `note_get`, `note_update`, `note_delete`, `note_list`, `search`.
- Skills: `/gerber:recall`, `/gerber:capture`, `/gerber:import`, `/gerber:archive`.
- Scripts: `pnpm mcp:reindex`, `pnpm --filter @gerber-caserne/mcp test:e5`, `prefetch-model`.
- Dependencies: `@huggingface/transformers`, `remark-parse`, `remark-gfm`, `remark-stringify`, `unified`, `unist-util-visit`, `concurrently`.

### Changed
- `get_stats` now reports counts on the surviving entities only (projects, tasks, issues, messages, handoffs) and DB size.
- `/gerber:review`, `/gerber:status`, `/gerber:session-complete` and the `agent-status` sub-agent refactored to drop the notes-related steps.
- Plugin description rewritten to reflect the new "orchestration only" scope.
- Documentation rewritten (`CLAUDE.md`, `README.md`, `.cave/*`).

### Verified
- `pnpm typecheck` ✅
- `pnpm test` — 164 / 164 ✅
- `pnpm build` ✅
