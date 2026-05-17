-- Migration 0008 — 2026-05-17
-- Drop the handoffs table.
-- Handoffs vivent désormais dans Linear (workspace eRom, team eRom-Agents,
-- projet Handoffs, label `handoff`). Mapping : status=inbox -> Linear Todo,
-- status=done -> Linear Done. Test pilote : EAT-170.
-- Pas de migration de data : décision Romain (<50 entités, valeur faible).
-- Pas de rollback : la migration est destructive. Backup recommandé avant apply.

DROP INDEX IF EXISTS idx_handoffs_created_at;
DROP INDEX IF EXISTS idx_handoffs_status;
DROP TABLE IF EXISTS handoffs;
