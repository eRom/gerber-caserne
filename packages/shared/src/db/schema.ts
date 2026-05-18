// All Drizzle tables have been dropped through migrations 0006-0011 :
// - 0006 : notes/chunks/embeddings (Gemini vault RAG)
// - 0007 : tasks/issues (Linear)
// - 0008 : handoffs (Linear)
// - 0009 : runbook (running_processes + columns on projects)
// - 0010 : messages (Airtable)
// - 0011 : projects
//
// The gerber MCP server is now stateless on the data side — the only
// surviving SQLite table is `_migrations` (migration journal).
// Kept as a file so existing imports `from '@gerber-caserne/shared/db/schema'`
// don't break, but it intentionally has no exports.
export {};
