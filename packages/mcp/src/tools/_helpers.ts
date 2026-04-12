import type { Database } from 'better-sqlite3';

export function resolveProjectSlug(db: Database, slug: string): string {
  const row = db
    .prepare('SELECT id FROM projects WHERE slug = ?')
    .get(slug) as { id: string } | undefined;
  if (!row) {
    throw new Error(`Project not found: slug="${slug}"`);
  }
  return row.id;
}
