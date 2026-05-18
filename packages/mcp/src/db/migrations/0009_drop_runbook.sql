-- Migration 0009 — 2026-05-18
-- Drop the runbook feature : detached process tracking + runbook columns on projects.
-- Feature unused since creation (3 weeks). Removed as part of the MCP simplification
-- pass (see also migrations 0006 notes, 0007 tasks/issues, 0008 handoffs).
-- Pas de rollback : la migration est destructive. Backup recommandé avant apply.

DROP TABLE IF EXISTS running_processes;
--> statement-breakpoint
ALTER TABLE projects DROP COLUMN env_json;
--> statement-breakpoint
ALTER TABLE projects DROP COLUMN url;
--> statement-breakpoint
ALTER TABLE projects DROP COLUMN run_cwd;
--> statement-breakpoint
ALTER TABLE projects DROP COLUMN run_cmd;
