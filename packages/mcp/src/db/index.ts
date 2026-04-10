import Database, { type Database as BetterSqliteDb } from 'better-sqlite3';

export function openDatabase(path: string): BetterSqliteDb {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('recursive_triggers = ON');
  return db;
}
