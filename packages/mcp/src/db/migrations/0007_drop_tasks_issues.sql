-- Migration 0007 — 2026-05-17
-- Drop tasks and issues tables.
-- Tasks et issues vivent désormais dans Linear (workspace eRom, team eRom-Agents).
-- 109 entités migrées le 2026-05-17 (range EAT-61 → EAT-169).
-- Pas de rollback : la migration est destructive. Backup recommandé avant apply.

DROP INDEX IF EXISTS idx_issues_severity;
DROP INDEX IF EXISTS idx_issues_project_status;
DROP TABLE IF EXISTS issues;

DROP INDEX IF EXISTS idx_tasks_status_position;
DROP INDEX IF EXISTS idx_tasks_parent;
DROP INDEX IF EXISTS idx_tasks_project_status;
DROP TABLE IF EXISTS tasks;
