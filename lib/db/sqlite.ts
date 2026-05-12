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
      template_prompt TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_image_assets_session_created
    ON image_assets(session_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_image_assets_message
    ON image_assets(message_id);

    CREATE TABLE IF NOT EXISTS image_templates (
      id TEXT PRIMARY KEY,
      source_image_id TEXT,
      source_session_id TEXT,
      source_message_id TEXT,
      session_title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      template_name TEXT,
      template_prompt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_image_templates_created
    ON image_templates(created_at);

    CREATE INDEX IF NOT EXISTS idx_image_templates_file_path
    ON image_templates(file_path);

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

  if (!columnNames.has("template_prompt")) {
    db.exec(`ALTER TABLE image_assets ADD COLUMN template_prompt TEXT`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_assets_template_created
    ON image_assets(is_template, created_at);

    INSERT OR IGNORE INTO image_templates (
      id,
      source_image_id,
      source_session_id,
      source_message_id,
      session_title,
      file_path,
      mime_type,
      source_type,
      template_name,
      template_prompt,
      created_at,
      updated_at
    )
    SELECT
      ia.id,
      ia.id,
      ia.session_id,
      ia.message_id,
      s.title,
      ia.file_path,
      ia.mime_type,
      ia.source_type,
      ia.template_name,
      COALESCE(ia.template_prompt, (
        SELECT m.content
        FROM messages m
        WHERE m.session_id = ia.session_id
          AND m.role = 'user'
          AND m.created_at <= am.created_at
        ORDER BY m.created_at DESC
        LIMIT 1
      )),
      ia.created_at,
      ia.created_at
    FROM image_assets ia
    JOIN sessions s ON s.id = ia.session_id
    JOIN messages am ON am.id = ia.message_id
    WHERE ia.is_template = 1
      AND ia.source_type = 'generated';

    UPDATE image_templates
    SET template_prompt = (
      SELECT m.content
      FROM messages m
      JOIN messages am ON am.id = image_templates.source_message_id
      WHERE m.session_id = image_templates.source_session_id
        AND m.role = 'user'
        AND m.created_at <= am.created_at
      ORDER BY m.created_at DESC
      LIMIT 1
    )
    WHERE template_prompt IS NULL
      AND EXISTS (
        SELECT 1
        FROM messages am
        WHERE am.id = image_templates.source_message_id
      );
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
