import { getDb } from "../db/sqlite.ts";
import { createId, nowIso } from "../db/helpers.ts";
import { removeStoredFile } from "../storage/file-storage.ts";
import { deriveSessionTitle } from "../validations/chat.ts";

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
  deleted_at: string | null;
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
  is_template: number;
  template_name: string | null;
  template_prompt: string | null;
  created_at: string;
};

type SessionListRow = SessionRow & {
  last_message_content: string | null;
};

type ImageTemplateRow = {
  id: string;
  source_image_id: string | null;
  source_session_id: string | null;
  source_message_id: string | null;
  session_title: string;
  file_path: string;
  mime_type: string;
  source_type: string;
  template_name: string | null;
  template_prompt: string | null;
  prompt: string;
  created_at: string;
  updated_at: string;
};

type TemplateSourceRow = {
  id: string;
  session_id: string;
  message_id: string;
  file_path: string;
  mime_type: string;
  source_type: string;
  created_at: string;
  session_title: string;
  prompt: string;
};

export type StoredImageInput = {
  filePath: string;
  mimeType: string;
  sourceType: string;
  width?: number | null;
  height?: number | null;
};

export type ImageTemplate = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  filePath: string;
  mimeType: string;
  sourceType: string;
  templateName: string | null;
  templatePrompt: string | null;
  prompt: string;
  createdAt: string;
};

const DEFAULT_PENDING_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_SESSION_TITLE = deriveSessionTitle("");
const STALE_PENDING_MESSAGE = "生成任务已超时，请重新提交。";

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
    isTemplate: Boolean(row.is_template),
    templateName: row.template_name,
    templatePrompt: row.template_prompt,
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
    deletedAt: row.deleted_at,
    images: images.map(mapImage)
  };
}

function updateSessionAfterUserPrompt(args: {
  db: ReturnType<typeof getDb>;
  sessionId: string;
  prompt: string;
  updatedAt: string;
}) {
  const session = args.db
    .prepare(
      `
        SELECT title
        FROM sessions
        WHERE id = ?
      `
    )
    .get(args.sessionId) as { title: string } | undefined;

  if (!session) {
    return;
  }

  const messageCount = args.db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM messages
        WHERE session_id = ?
          AND deleted_at IS NULL
      `
    )
    .get(args.sessionId) as { count: number };

  if (messageCount.count === 0 && session.title === DEFAULT_SESSION_TITLE) {
    args.db
      .prepare(`UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`)
      .run(deriveSessionTitle(args.prompt), args.updatedAt, args.sessionId);
    return;
  }

  args.db
    .prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`)
    .run(args.updatedAt, args.sessionId);
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
              AND m.deleted_at IS NULL
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
  expireStalePendingMessages({ sessionId: id });
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
        SELECT id, session_id, role, content, status, created_at, deleted_at
        FROM messages
        WHERE session_id = ?
          AND deleted_at IS NULL
        ORDER BY created_at ASC
      `
    )
    .all(id) as MessageRow[];

  const imageRows = db
    .prepare(
      `
        SELECT id, session_id, message_id, file_path, mime_type, width, height, source_type, is_template, template_name, template_prompt, created_at
        FROM image_assets
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(id) as ImageAssetRow[];

  const imagesByMessageId = new Map<string, ImageAssetRow[]>();

  for (const image of imageRows) {
    const current = imagesByMessageId.get(image.message_id) ?? [];
    current.push(image);
    imagesByMessageId.set(image.message_id, current);
  }

  return {
    ...mapSession(sessionRow),
    messages: messageRows.map((message) =>
      mapMessage(message, imagesByMessageId.get(message.id) ?? [])
    )
  };
}

export async function createUserMessage(sessionId: string, content: string) {
  const db = getDb();
  const id = createId();
  const now = nowIso();

  const transaction = db.transaction(() => {
    updateSessionAfterUserPrompt({
      db,
      sessionId,
      prompt: content,
      updatedAt: now
    });

    db.prepare(
      `
        INSERT INTO messages (id, session_id, role, content, status, created_at)
        VALUES (?, ?, 'user', ?, 'success', ?)
      `
    ).run(id, sessionId, content, now);
  });

  transaction();

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

function insertImageAssets(args: {
  db: ReturnType<typeof getDb>;
  sessionId: string;
  messageId: string;
  images?: StoredImageInput[];
  createdAt: string;
}) {
  const insertImage = args.db.prepare(
    `
      INSERT INTO image_assets (
        id, session_id, message_id, file_path, mime_type, width, height, source_type, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const image of args.images ?? []) {
    insertImage.run(
      createId(),
      args.sessionId,
      args.messageId,
      image.filePath,
      image.mimeType,
      image.width ?? null,
      image.height ?? null,
      image.sourceType,
      args.createdAt
    );
  }
}

export async function createImageGenerationMessages(args: {
  sessionId: string;
  prompt: string;
  assistantContent: string;
  assistantImages?: StoredImageInput[];
}) {
  const db = getDb();
  const now = nowIso();
  const userMessageId = createId();
  const assistantMessageId = createId();

  const transaction = db.transaction(() => {
    updateSessionAfterUserPrompt({
      db,
      sessionId: args.sessionId,
      prompt: args.prompt,
      updatedAt: now
    });

    db.prepare(
      `
        INSERT INTO messages (id, session_id, role, content, status, created_at)
        VALUES (?, ?, 'user', ?, 'success', ?)
      `
    ).run(userMessageId, args.sessionId, args.prompt, now);

    db.prepare(
      `
        INSERT INTO messages (id, session_id, role, content, status, created_at)
        VALUES (?, ?, 'assistant', ?, 'pending', ?)
      `
    ).run(assistantMessageId, args.sessionId, args.assistantContent, now);

    insertImageAssets({
      db,
      sessionId: args.sessionId,
      messageId: assistantMessageId,
      images: args.assistantImages,
      createdAt: now
    });
  });

  transaction();

  const userMessage = getMessageWithImages(userMessageId);
  const assistantMessage = getMessageWithImages(assistantMessageId);

  if (!userMessage || !assistantMessage) {
    throw new Error("Failed to create generation messages");
  }

  return {
    userMessage,
    assistantMessage
  };
}

function getMessageWithImages(messageId: string) {
  const db = getDb();
  const messageRow = db
    .prepare(
      `
        SELECT id, session_id, role, content, status, created_at, deleted_at
        FROM messages
        WHERE id = ?
          AND deleted_at IS NULL
      `
    )
    .get(messageId) as MessageRow | undefined;

  if (!messageRow) {
    return null;
  }

  const imageRows = db
    .prepare(
      `
        SELECT id, session_id, message_id, file_path, mime_type, width, height, source_type, is_template, template_name, template_prompt, created_at
        FROM image_assets
        WHERE message_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(messageId) as ImageAssetRow[];

  return mapMessage(messageRow, imageRows);
}

function getImageById(imageId: string) {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT id, session_id, message_id, file_path, mime_type, width, height, source_type, is_template, template_name, template_prompt, created_at
        FROM image_assets
        WHERE id = ?
      `
    )
    .get(imageId) as ImageAssetRow | undefined;

  return row ? mapImage(row) : null;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value?.trim() || null;
}

function getImageTemplateRow(
  db: ReturnType<typeof getDb>,
  templateId: string
) {
  return db
    .prepare(
      `
        SELECT
          it.id,
          it.source_image_id,
          it.source_session_id,
          it.source_message_id,
          it.session_title,
          it.file_path,
          it.mime_type,
          it.source_type,
          it.template_name,
          it.template_prompt,
          COALESCE(it.template_prompt, (
            SELECT m.content
            FROM messages m
            WHERE m.session_id = it.source_session_id
              AND m.role = 'user'
              AND m.created_at <= COALESCE(am.created_at, it.created_at)
            ORDER BY m.created_at DESC
            LIMIT 1
          ), '') AS prompt,
          it.created_at,
          it.updated_at
        FROM image_templates it
        LEFT JOIN messages am ON am.id = it.source_message_id
        WHERE it.id = ?
      `
    )
    .get(templateId) as ImageTemplateRow | undefined;
}

function getGeneratedTemplateSource(
  db: ReturnType<typeof getDb>,
  imageId: string
) {
  return db
    .prepare(
      `
        SELECT
          ia.id,
          ia.session_id,
          ia.message_id,
          ia.file_path,
          ia.mime_type,
          ia.source_type,
          ia.created_at,
          s.title AS session_title,
          COALESCE(ia.template_prompt, (
            SELECT m.content
            FROM messages m
            WHERE m.session_id = ia.session_id
              AND m.role = 'user'
              AND m.created_at <= am.created_at
            ORDER BY m.created_at DESC
            LIMIT 1
          ), '') AS prompt
        FROM image_assets ia
        JOIN sessions s ON s.id = ia.session_id
        JOIN messages am ON am.id = ia.message_id
        WHERE ia.id = ?
          AND ia.source_type = 'generated'
      `
    )
    .get(imageId) as TemplateSourceRow | undefined;
}

function mapTemplate(row: ImageTemplateRow): ImageTemplate {
  return {
    id: row.id,
    sessionId: row.source_session_id ?? "",
    sessionTitle: row.session_title,
    messageId: row.source_message_id ?? "",
    filePath: row.file_path,
    mimeType: row.mime_type,
    sourceType: row.source_type,
    templateName: row.template_name,
    templatePrompt: row.template_prompt,
    prompt: row.prompt,
    createdAt: row.created_at
  };
}

export async function updateImageTemplate(args: {
  imageId: string;
  isTemplate: boolean;
  templateName?: string | null;
  templatePrompt?: string | null;
}) {
  const db = getDb();
  const existingTemplate = getImageTemplateRow(db, args.imageId);
  const source = getGeneratedTemplateSource(db, args.imageId);
  const nextTemplateName = normalizeOptionalText(args.templateName);
  const nextTemplatePrompt = normalizeOptionalText(args.templatePrompt);

  if (!args.isTemplate) {
    if (!existingTemplate && !source) {
      return null;
    }

    const transaction = db.transaction(() => {
      db.prepare(`DELETE FROM image_templates WHERE id = ?`).run(args.imageId);
      db.prepare(
        `
          UPDATE image_assets
          SET is_template = 0, template_name = NULL, template_prompt = NULL
          WHERE id = ?
        `
      ).run(args.imageId);
    });

    transaction();

    return (
      getImageById(args.imageId) ??
      (existingTemplate ? mapTemplate(existingTemplate) : null)
    );
  }

  const templateName =
    nextTemplateName === undefined
      ? existingTemplate?.template_name ?? null
      : nextTemplateName;

  if (!source) {
    if (!existingTemplate) {
      return null;
    }

    const templatePrompt =
      nextTemplatePrompt === undefined
        ? existingTemplate.template_prompt
        : nextTemplatePrompt;
    const updatedAt = nowIso();

    db.prepare(
      `
        UPDATE image_templates
        SET template_name = ?, template_prompt = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(templateName, templatePrompt, updatedAt, args.imageId);

    const updatedTemplate = getImageTemplateRow(db, args.imageId);
    return updatedTemplate ? mapTemplate(updatedTemplate) : null;
  }

  const templatePrompt =
    nextTemplatePrompt === undefined
      ? existingTemplate?.template_prompt ?? (source.prompt || null)
      : nextTemplatePrompt;
  const updatedAt = nowIso();

  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO image_templates (
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source_image_id = excluded.source_image_id,
          source_session_id = excluded.source_session_id,
          source_message_id = excluded.source_message_id,
          session_title = excluded.session_title,
          file_path = excluded.file_path,
          mime_type = excluded.mime_type,
          source_type = excluded.source_type,
          template_name = excluded.template_name,
          template_prompt = excluded.template_prompt,
          updated_at = excluded.updated_at
      `
    ).run(
      source.id,
      source.id,
      source.session_id,
      source.message_id,
      source.session_title,
      source.file_path,
      source.mime_type,
      source.source_type,
      templateName,
      templatePrompt,
      existingTemplate?.created_at ?? source.created_at,
      updatedAt
    );

    db.prepare(
      `
        UPDATE image_assets
        SET is_template = 1, template_name = ?, template_prompt = ?
        WHERE id = ?
          AND source_type = 'generated'
      `
    ).run(templateName, templatePrompt, args.imageId);
  });

  transaction();

  return getImageById(args.imageId);
}

export async function listImageTemplates(): Promise<ImageTemplate[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          it.id,
          it.source_image_id,
          it.source_session_id,
          it.source_message_id,
          it.session_title,
          it.file_path,
          it.mime_type,
          it.source_type,
          it.template_name,
          it.template_prompt,
          COALESCE(it.template_prompt, (
            SELECT m.content
            FROM messages m
            WHERE m.session_id = it.source_session_id
              AND m.role = 'user'
              AND m.created_at <= COALESCE(am.created_at, it.created_at)
            ORDER BY m.created_at DESC
            LIMIT 1
          ), '') AS prompt,
          it.created_at,
          it.updated_at
        FROM image_templates it
        LEFT JOIN messages am ON am.id = it.source_message_id
        ORDER BY it.created_at DESC
      `
    )
    .all() as ImageTemplateRow[];

  return rows.map(mapTemplate);
}

export async function createPendingAssistantMessage(args: {
  sessionId: string;
  content: string;
  images?: StoredImageInput[];
}) {
  const db = getDb();
  const now = nowIso();
  const messageId = createId();

  const insertMessage = db.prepare(
    `
      INSERT INTO messages (id, session_id, role, content, status, created_at)
      VALUES (?, ?, 'assistant', ?, 'pending', ?)
    `
  );

  const transaction = db.transaction(() => {
    insertMessage.run(messageId, args.sessionId, args.content, now);
    insertImageAssets({
      db,
      sessionId: args.sessionId,
      messageId,
      images: args.images,
      createdAt: now
    });

    db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(
      now,
      args.sessionId
    );
  });

  transaction();

  const message = getMessageWithImages(messageId);

  if (!message) {
    throw new Error("Failed to create pending assistant message");
  }

  return message;
}

export async function updateAssistantMessageWithImages(args: {
  messageId: string;
  sessionId: string;
  content: string;
  status: "success" | "failed";
  images?: StoredImageInput[];
}) {
  const db = getDb();
  const now = nowIso();

  const existing = db
    .prepare(
      `
        SELECT id
        FROM messages
        WHERE id = ?
          AND session_id = ?
          AND role = 'assistant'
          AND status = 'pending'
      `
    )
    .get(args.messageId, args.sessionId) as { id: string } | undefined;

  if (!existing) {
    return null;
  }

  const transaction = db.transaction(() => {
    db.prepare(
      `
        UPDATE messages
        SET content = ?, status = ?
        WHERE id = ?
          AND session_id = ?
          AND role = 'assistant'
          AND status = 'pending'
      `
    ).run(args.content, args.status, args.messageId, args.sessionId);

    db.prepare(`DELETE FROM image_assets WHERE message_id = ?`).run(args.messageId);
    insertImageAssets({
      db,
      sessionId: args.sessionId,
      messageId: args.messageId,
      images: args.images,
      createdAt: now
    });

    db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(
      now,
      args.sessionId
    );
  });

  transaction();

  return getMessageWithImages(args.messageId);
}

export function expireStalePendingMessages(args?: {
  sessionId?: string;
  olderThanMs?: number;
  nowMs?: number;
}) {
  const db = getDb();
  const olderThanMs = args?.olderThanMs ?? DEFAULT_PENDING_TIMEOUT_MS;
  const nowMs = args?.nowMs ?? Date.now();
  const cutoff = new Date(nowMs - olderThanMs).toISOString();

  const sql = `
    UPDATE messages
    SET status = 'failed', content = ?
    WHERE role = 'assistant'
      AND status = 'pending'
      AND created_at < ?
      ${args?.sessionId ? "AND session_id = ?" : ""}
  `;
  const params = args?.sessionId
    ? [STALE_PENDING_MESSAGE, cutoff, args.sessionId]
    : [STALE_PENDING_MESSAGE, cutoff];
  const result = db.prepare(sql).run(...params);

  return result.changes;
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
        SELECT id, session_id, message_id, file_path, mime_type, width, height, source_type, is_template, template_name, template_prompt, created_at
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
        SELECT DISTINCT ia.file_path
        FROM image_assets ia
        WHERE ia.session_id = ?
          AND NOT EXISTS (
            SELECT 1
            FROM image_templates it
            WHERE it.file_path = ia.file_path
          )
          AND NOT EXISTS (
            SELECT 1
            FROM image_assets other
            WHERE other.file_path = ia.file_path
              AND other.session_id <> ia.session_id
          )
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
        SELECT DISTINCT ia.file_path
        FROM image_assets ia
        WHERE ia.message_id = ?
          AND NOT EXISTS (
            SELECT 1
            FROM image_templates it
            WHERE it.file_path = ia.file_path
          )
          AND NOT EXISTS (
            SELECT 1
            FROM image_assets other
            WHERE other.file_path = ia.file_path
              AND other.message_id <> ia.message_id
          )
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
          AND deleted_at IS NULL
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
          AND deleted_at IS NULL
      `
    )
    .get(messageId) as { id: string; session_id: string } | undefined;

  if (!message) {
    return null;
  }

  const deletedAt = nowIso();

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE messages SET deleted_at = ? WHERE id = ?`).run(
      deletedAt,
      messageId
    );
    refreshSessionUpdatedAt(message.session_id);
  });

  transaction();

  return {
    messageId,
    sessionId: message.session_id,
    deletedAt
  };
}

export async function restoreMessageById(messageId: string) {
  const db = getDb();
  const message = db
    .prepare(
      `
        SELECT id, session_id
        FROM messages
        WHERE id = ?
          AND deleted_at IS NOT NULL
      `
    )
    .get(messageId) as { id: string; session_id: string } | undefined;

  if (!message) {
    return null;
  }

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE messages SET deleted_at = NULL WHERE id = ?`).run(messageId);
    refreshSessionUpdatedAt(message.session_id);
  });

  transaction();

  return {
    messageId,
    sessionId: message.session_id
  };
}

export async function hardDeleteMessageById(messageId: string) {
  const db = getDb();
  const message = db
    .prepare(
      `
        SELECT id, session_id
        FROM messages
        WHERE id = ?
          AND deleted_at IS NOT NULL
      `
    )
    .get(messageId) as { id: string; session_id: string } | undefined;

  if (!message) {
    return null;
  }

  const filePaths = getMessageImagePaths(messageId);

  const transaction = db.transaction(() => {
    db.prepare(`DELETE FROM image_assets WHERE message_id = ?`).run(messageId);
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

export async function listDeletedMessages(sessionId: string) {
  const db = getDb();
  const messageRows = db
    .prepare(
      `
        SELECT id, session_id, role, content, status, created_at, deleted_at
        FROM messages
        WHERE session_id = ?
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `
    )
    .all(sessionId) as MessageRow[];

  const imageRows = db
    .prepare(
      `
        SELECT id, session_id, message_id, file_path, mime_type, width, height, source_type, is_template, template_name, template_prompt, created_at
        FROM image_assets
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(sessionId) as ImageAssetRow[];

  const imagesByMessageId = new Map<string, ImageAssetRow[]>();

  for (const image of imageRows) {
    const current = imagesByMessageId.get(image.message_id) ?? [];
    current.push(image);
    imagesByMessageId.set(image.message_id, current);
  }

  return messageRows.map((message) =>
    mapMessage(message, imagesByMessageId.get(message.id) ?? [])
  );
}

