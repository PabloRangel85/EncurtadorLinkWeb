import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";

export type AppDatabase = Database<sqlite3.Database, sqlite3.Statement>;

export async function createDatabase(databasePath: string): Promise<AppDatabase> {
  if (databasePath !== ":memory:") {
    await mkdir(dirname(databasePath), { recursive: true });
  }

  const database = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  await database.exec("PRAGMA foreign_keys = ON;");
  if (databasePath !== ":memory:") {
    await database.exec("PRAGMA journal_mode = WAL;");
  }

  await database.exec(`
    CREATE TABLE IF NOT EXISTS links (
      slug TEXT PRIMARY KEY CHECK (length(slug) = 6),
      original_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS click_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL REFERENCES links(slug) ON DELETE CASCADE,
      clicked_at TEXT NOT NULL,
      user_agent TEXT,
      referrer TEXT
    );

    CREATE INDEX IF NOT EXISTS click_events_slug_idx ON click_events(slug);
  `);

  return database;
}