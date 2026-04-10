// This file contains ONLY derived objects (virtual tables, views, triggers).
// CREATE TABLE statements live in the Drizzle-generated migrations under ./migrations/.
// Do not add a regular table here — it would bypass the schema source of truth.

export const DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  content,
  content='',
  content_rowid=rowid
);

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
`;
