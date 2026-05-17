-- Drop the notes/chunks/embeddings/FTS subsystem.
-- Knowledge memory is now delegated to the Gemini vault RAG (eRom/gerber-vault).
-- Tasks, issues, messages, handoffs, runbook and projects remain.
DROP TRIGGER IF EXISTS notes_ai_fts;
--> statement-breakpoint
DROP TRIGGER IF EXISTS notes_au_fts;
--> statement-breakpoint
DROP TRIGGER IF EXISTS notes_ad_fts;
--> statement-breakpoint
DROP TRIGGER IF EXISTS chunks_ai_fts;
--> statement-breakpoint
DROP TRIGGER IF EXISTS chunks_au_fts;
--> statement-breakpoint
DROP TRIGGER IF EXISTS chunks_ad_fts;
--> statement-breakpoint
DROP TRIGGER IF EXISTS notes_ad_emb;
--> statement-breakpoint
DROP TRIGGER IF EXISTS chunks_ad_emb;
--> statement-breakpoint
DROP VIEW IF EXISTS embedding_owners;
--> statement-breakpoint
DROP TABLE IF EXISTS notes_fts;
--> statement-breakpoint
DROP TABLE IF EXISTS fts_source;
--> statement-breakpoint
DROP TABLE IF EXISTS embeddings;
--> statement-breakpoint
DROP TABLE IF EXISTS chunks;
--> statement-breakpoint
DROP TABLE IF EXISTS notes;
--> statement-breakpoint
DROP TABLE IF EXISTS app_meta;
