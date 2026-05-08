import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

type DatabaseInstance = Database.Database;

const globalForDb = globalThis as typeof globalThis & {
  sqlite?: DatabaseInstance;
};

function resolveDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Only SQLite file: DATABASE_URL values are supported");
  }

  const relativePath = databaseUrl.slice("file:".length);
  return path.resolve(process.cwd(), relativePath);
}

function initializeDatabase(db: DatabaseInstance) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_created
    ON messages(session_id, created_at);

    CREATE TABLE IF NOT EXISTS image_assets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      source_type TEXT NOT NULL,
      is_template INTEGER NOT NULL DEFAULT 0,
      template_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_image_assets_session_created
    ON image_assets(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_image_assets_message
    ON image_assets(message_id);

    CREATE TABLE IF NOT EXISTS runtime_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const imageAssetColumns = db
    .prepare(`PRAGMA table_info(image_assets)`)
    .all() as Array<{ name: string }>;
  const columnNames = new Set(imageAssetColumns.map((column) => column.name));

  if (!columnNames.has("is_template")) {
    db.exec(`ALTER TABLE image_assets ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0`);
  }

  if (!columnNames.has("template_name")) {
    db.exec(`ALTER TABLE image_assets ADD COLUMN template_name TEXT`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_assets_template_created
    ON image_assets(is_template, created_at);
  `);
}

export function getDb() {
  if (globalForDb.sqlite) {
    initializeDatabase(globalForDb.sqlite);
    return globalForDb.sqlite;
  }

  const filePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const db = new Database(filePath);
  initializeDatabase(db);
  globalForDb.sqlite = db;

  return db;
}

export function closeDbForTests() {
  if (!globalForDb.sqlite) {
    return;
  }

  globalForDb.sqlite.close();
  globalForDb.sqlite = undefined;
}
