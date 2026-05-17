// This file contains ONLY derived objects (virtual tables, views, triggers).
// CREATE TABLE statements live in the Drizzle-generated migrations under ./migrations/.
// Do not add a regular table here — it would bypass the schema source of truth.
//
// IMPORTANT: triggers use DROP + CREATE (not IF NOT EXISTS) so that schema
// changes are always applied on existing databases. The DDL is executed on
// every startup via applyMigrations().
//
// Notes/chunks/embeddings were removed in migration 0006; no derived
// objects remain on the surviving tables yet. Keep this hook in place so
// future virtual tables or triggers can be added easily.

export const DDL = '';
