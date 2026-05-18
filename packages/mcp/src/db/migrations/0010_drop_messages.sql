-- Migration 0010 — 2026-05-18
-- Drop the messages table.
-- Messages bus now lives on Airtable (workspace `gerber-bus`, base `bus`,
-- table `Messages`). The migration is destructive — pas de rollback. Pas de
-- migration de data (Romain a confirmé : rien d'important à conserver).
-- Skills `/gerber:send` et `/gerber:inbox` ont été réécrites pour pointer
-- directement vers le plugin Airtable MCP, plus rien ne lit la table locale.

DROP INDEX IF EXISTS idx_messages_created_at;
--> statement-breakpoint
DROP INDEX IF EXISTS idx_messages_type_status;
--> statement-breakpoint
DROP INDEX IF EXISTS idx_messages_project_status;
--> statement-breakpoint
DROP TABLE IF EXISTS messages;
