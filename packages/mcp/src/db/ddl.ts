// This file contains ONLY derived objects (virtual tables, views, triggers).
// CREATE TABLE statements live in the Drizzle-generated migrations under ./migrations/.
// Do not add a regular table here — it would bypass the schema source of truth.
//
// IMPORTANT: triggers use DROP + CREATE (not IF NOT EXISTS) so that schema
// changes are always applied on existing databases. The DDL is executed on
// every startup via applyMigrations().

export const DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  content,
  content='',
  content_rowid=rowid
);

-- Maps FTS5 rowids to their source (note or chunk).
-- FTS5 contentless tables don't store column values, so we can't read
-- source_type/source_id back from the FTS table. This lookup table solves that.
CREATE TABLE IF NOT EXISTS fts_source (
  fts_rowid INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,  -- 'note' or 'chunk'
  source_id TEXT NOT NULL     -- UUID of the note or chunk
);

CREATE INDEX IF NOT EXISTS fts_source_id_idx ON fts_source(source_id);

CREATE VIEW IF NOT EXISTS embedding_owners AS
SELECT
  e.owner_type,
  e.owner_id,
  e.model,
  e.vector,
  CASE e.owner_type
    WHEN 'note'  THEN n.id
    WHEN 'chunk' THEN c_note.id
  END AS note_id,
  CASE e.owner_type
    WHEN 'note'  THEN n.project_id
    WHEN 'chunk' THEN c_note.project_id
  END AS project_id,
  CASE e.owner_type
    WHEN 'note'  THEN n.kind
    WHEN 'chunk' THEN c_note.kind
  END AS kind,
  CASE e.owner_type
    WHEN 'note'  THEN n.status
    WHEN 'chunk' THEN c_note.status
  END AS status,
  CASE e.owner_type
    WHEN 'note'  THEN n.tags
    WHEN 'chunk' THEN c_note.tags
  END AS tags,
  CASE e.owner_type
    WHEN 'note'  THEN n.source
    WHEN 'chunk' THEN c_note.source
  END AS source
FROM embeddings e
LEFT JOIN notes n ON e.owner_type = 'note' AND e.owner_id = n.id
LEFT JOIN chunks c ON e.owner_type = 'chunk' AND e.owner_id = c.id
LEFT JOIN notes c_note ON c.note_id = c_note.id;

-- =========================================================================
-- FTS5 sync triggers — DROP + CREATE to ensure schema changes apply
-- =========================================================================

-- Notes triggers (atoms only)
DROP TRIGGER IF EXISTS notes_ai_fts;
CREATE TRIGGER notes_ai_fts
AFTER INSERT ON notes
WHEN NEW.kind = 'atom'
BEGIN
  INSERT INTO notes_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
  INSERT OR REPLACE INTO fts_source(fts_rowid, source_type, source_id) VALUES (NEW.rowid, 'note', NEW.id);
END;

DROP TRIGGER IF EXISTS notes_au_fts;
CREATE TRIGGER notes_au_fts
AFTER UPDATE ON notes
WHEN NEW.kind = 'atom'
BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', OLD.rowid, OLD.title, OLD.content);
  INSERT INTO notes_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
  INSERT OR REPLACE INTO fts_source(fts_rowid, source_type, source_id) VALUES (NEW.rowid, 'note', NEW.id);
END;

DROP TRIGGER IF EXISTS notes_ad_fts;
CREATE TRIGGER notes_ad_fts
AFTER DELETE ON notes
WHEN OLD.kind = 'atom'
BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', OLD.rowid, OLD.title, OLD.content);
  DELETE FROM fts_source WHERE fts_rowid = OLD.rowid AND source_type = 'note';
END;

-- Chunks triggers
-- CRITICAL: chunks and notes have SEPARATE rowid sequences. To avoid collisions
-- in notes_fts (which holds both), we offset chunk rowids by 1 billion.
DROP TRIGGER IF EXISTS chunks_ai_fts;
CREATE TRIGGER chunks_ai_fts
AFTER INSERT ON chunks
BEGIN
  INSERT INTO notes_fts(rowid, title, content) VALUES (1000000000 + NEW.rowid, NEW.heading_path, NEW.content);
  INSERT OR REPLACE INTO fts_source(fts_rowid, source_type, source_id) VALUES (1000000000 + NEW.rowid, 'chunk', NEW.id);
END;

DROP TRIGGER IF EXISTS chunks_au_fts;
CREATE TRIGGER chunks_au_fts
AFTER UPDATE ON chunks
BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', 1000000000 + OLD.rowid, OLD.heading_path, OLD.content);
  INSERT INTO notes_fts(rowid, title, content) VALUES (1000000000 + NEW.rowid, NEW.heading_path, NEW.content);
  INSERT OR REPLACE INTO fts_source(fts_rowid, source_type, source_id) VALUES (1000000000 + NEW.rowid, 'chunk', NEW.id);
END;

DROP TRIGGER IF EXISTS chunks_ad_fts;
CREATE TRIGGER chunks_ad_fts
AFTER DELETE ON chunks
BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', 1000000000 + OLD.rowid, OLD.heading_path, OLD.content);
  DELETE FROM fts_source WHERE fts_rowid = 1000000000 + OLD.rowid AND source_type = 'chunk';
END;

-- Embeddings cleanup triggers
DROP TRIGGER IF EXISTS notes_ad_emb;
CREATE TRIGGER notes_ad_emb
AFTER DELETE ON notes
BEGIN
  DELETE FROM embeddings WHERE owner_type = 'note' AND owner_id = OLD.id;
END;

DROP TRIGGER IF EXISTS chunks_ad_emb;
CREATE TRIGGER chunks_ad_emb
AFTER DELETE ON chunks
BEGIN
  DELETE FROM embeddings WHERE owner_type = 'chunk' AND owner_id = OLD.id;
END;

-- =========================================================================
-- FTS5 data migration: rebuild fts_source from existing data.
-- This runs on every startup but is fast (only inserts missing rows).
-- =========================================================================
INSERT OR IGNORE INTO fts_source(fts_rowid, source_type, source_id)
  SELECT rowid, 'note', id FROM notes WHERE kind = 'atom';
INSERT OR IGNORE INTO fts_source(fts_rowid, source_type, source_id)
  SELECT 1000000000 + rowid, 'chunk', id FROM chunks;
`;
