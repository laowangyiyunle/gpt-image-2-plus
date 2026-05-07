import { getDb } from "@/lib/db/sqlite";
import { createId, nowIso } from "@/lib/db/helpers";
import { removeStoredFile } from "@/lib/storage/file-storage";
import { deriveSessionTitle } from "@/lib/validations/chat";

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  status: string;
  created_at: string;
};

type ImageAssetRow = {
  id: string;
  session_id: string;
  message_id: string;
  file_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  source_type: string;
  created_at: string;
};

type SessionListRow = SessionRow & {
  last_message_content: string | null;
};

export type StoredImageInput = {
  filePath: string;
  mimeType: string;
  sourceType: string;
  width?: number | null;
  height?: number | null;
};

function mapSession(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapImage(row: ImageAssetRow) {
  return {
    id: row.id,
    filePath: row.file_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    sourceType: row.source_type,
    createdAt: row.created_at
  };
}

function mapMessage(row: MessageRow, images: ImageAssetRow[]) {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    status: row.status as "pending" | "success" | "failed",
    createdAt: row.created_at,
    images: images.map(mapImage)
  };
}

export async function createSession(initialContent?: string) {
  const db = getDb();
  const id = createId();
  const now = nowIso();
  const title = deriveSessionTitle(initialContent ?? "");

  db.prepare(
    `
      INSERT INTO sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `
  ).run(id, title, now, now);

  return {
    id,
    title,
    createdAt: now,
    updatedAt: now
  };
}

export async function listSessions() {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          s.id,
          s.title,
          s.created_at,
          s.updated_at,
          (
            SELECT m.content
            FROM messages m
            WHERE m.session_id = s.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS last_message_content
        FROM sessions s
        ORDER BY s.updated_at DESC
      `
    )
    .all() as SessionListRow[];

  return rows.map((row) => ({
    ...mapSession(row),
    lastMessage: row.last_message_content
  }));
}

export async function getSessionById(id: string) {
  const db = getDb();
  const sessionRow = db
    .prepare(
      `
        SELECT id, title, created_at, updated_at
        FROM sessions
        WHERE id = ?
      `
    )
    .get(id) as SessionRow | undefined;

  if (!sessionRow) {
    return null;
  }

  const messageRows = db
    .prepare(
      `
        SELECT id, session_id, role, content, status, created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(id) as MessageRow[];

  const imageRows = db
    .prepare(
      `
        SELECT id, session_id, message_id, file_path, mime_type, width, height, source_type, created_at
        FROM image_assets
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(id) as ImageAssetRow[];

  return {
    ...mapSession(sessionRow),
    messages: messageRows.map((message) =>
      mapMessage(
        message,
        imageRows.filter((image) => image.message_id === message.id)
      )
    )
  };
}

export async function createUserMessage(sessionId: string, content: string) {
  const db = getDb();
  const id = createId();
  const now = nowIso();

  db.prepare(
    `
      INSERT INTO messages (id, session_id, role, content, status, created_at)
      VALUES (?, ?, 'user', ?, 'success', ?)
    `
  ).run(id, sessionId, content, now);

  db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(now, sessionId);

  return {
    id,
    sessionId,
    role: "user" as const,
    content,
    status: "success" as const,
    createdAt: now,
    images: []
  };
}

export async function createAssistantMessageWithImages(args: {
  sessionId: string;
  content: string;
  status: "success" | "failed";
  images?: StoredImageInput[];
}) {
  const db = getDb();
  const now = nowIso();
  const messageId = createId();

  const insertMessage = db.prepare(
    `
      INSERT INTO messages (id, session_id, role, content, status, created_at)
      VALUES (?, ?, 'assistant', ?, ?, ?)
    `
  );

  const insertImage = db.prepare(
    `
      INSERT INTO image_assets (
        id, session_id, message_id, file_path, mime_type, width, height, source_type, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  const updateSession = db.prepare(
    `UPDATE sessions SET updated_at = ? WHERE id = ?`
  );

  const transaction = db.transaction(() => {
    insertMessage.run(messageId, args.sessionId, args.content, args.status, now);

    for (const image of args.images ?? []) {
      insertImage.run(
        createId(),
        args.sessionId,
        messageId,
        image.filePath,
        image.mimeType,
        image.width ?? null,
        image.height ?? null,
        image.sourceType,
        now
      );
    }

    updateSession.run(now, args.sessionId);
  });

  transaction();

  const imageRows = db
    .prepare(
      `
        SELECT id, session_id, message_id, file_path, mime_type, width, height, source_type, created_at
        FROM image_assets
        WHERE message_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(messageId) as ImageAssetRow[];

  return {
    id: messageId,
    role: "assistant" as const,
    content: args.content,
    status: args.status,
    createdAt: now,
    images: imageRows.map(mapImage)
  };
}

function getSessionImagePaths(sessionId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT file_path
        FROM image_assets
        WHERE session_id = ?
      `
    )
    .all(sessionId) as Array<{ file_path: string }>;

  return rows.map((row) => row.file_path);
}

function getMessageImagePaths(messageId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT file_path
        FROM image_assets
        WHERE message_id = ?
      `
    )
    .all(messageId) as Array<{ file_path: string }>;

  return rows.map((row) => row.file_path);
}

async function cleanupFiles(filePaths: string[]) {
  await Promise.all(
    filePaths.map((filePath) => removeStoredFile(filePath).catch(() => undefined))
  );
}

function refreshSessionUpdatedAt(sessionId: string) {
  const db = getDb();
  const sessionRow = db
    .prepare(
      `
        SELECT created_at
        FROM sessions
        WHERE id = ?
      `
    )
    .get(sessionId) as { created_at: string } | undefined;

  if (!sessionRow) {
    return;
  }

  const latestMessage = db
    .prepare(
      `
        SELECT created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(sessionId) as { created_at: string } | undefined;

  db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(
    latestMessage?.created_at ?? sessionRow.created_at,
    sessionId
  );
}

export async function deleteSessionById(sessionId: string) {
  const db = getDb();
  const session = db
    .prepare(`SELECT id FROM sessions WHERE id = ?`)
    .get(sessionId) as { id: string } | undefined;

  if (!session) {
    return false;
  }

  const filePaths = getSessionImagePaths(sessionId);
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
  await cleanupFiles(filePaths);

  return true;
}

export async function deleteMessageById(messageId: string) {
  const db = getDb();
  const message = db
    .prepare(
      `
        SELECT id, session_id
        FROM messages
        WHERE id = ?
      `
    )
    .get(messageId) as { id: string; session_id: string } | undefined;

  if (!message) {
    return null;
  }

  const filePaths = getMessageImagePaths(messageId);

  const transaction = db.transaction(() => {
    db.prepare(`DELETE FROM messages WHERE id = ?`).run(messageId);
    refreshSessionUpdatedAt(message.session_id);
  });

  transaction();
  await cleanupFiles(filePaths);

  return {
    messageId,
    sessionId: message.session_id
  };
}
