-- Migration 0011 — 2026-05-18
-- Drop the projects table and the seed it carried.
-- After this migration, the gerber MCP server holds only the `_migrations`
-- journal table. No business data remains : tools `project_*` (CRUD),
-- `backup_brain`, `get_stats` are removed. The 2 surviving tools (`rag`,
-- `rag_onboard`) are stateless — they talk to Gemini + GitHub APIs, no DB.
-- Pas de rollback : la migration est destructive.

DROP TABLE IF EXISTS projects;
