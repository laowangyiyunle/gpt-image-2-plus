import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const testDbPath = path.resolve(
  `tmp/session-pending-message.${process.pid}.${Date.now()}.test.db`
);
process.env.DATABASE_URL = `file:${testDbPath}`;

const {
  createImageGenerationMessages,
  createPendingAssistantMessage,
  createSession,
  expireStalePendingMessages,
  getSessionById,
  updateAssistantMessageWithImages
} = await import("../lib/services/session-service.ts");
const { closeDbForTests } = await import("../lib/db/sqlite.ts");

const session = await createSession("recover pending generation");
const pending = await createPendingAssistantMessage({
  sessionId: session.id,
  content: "图片生成任务已提交，请稍等。",
  images: [
    {
      filePath: "/uploads/reference.png",
      mimeType: "image/png",
      sourceType: "uploaded"
    }
  ]
});

assert.equal(pending.status, "pending");
assert.equal(pending.images.length, 1);

let hydrated = await getSessionById(session.id);
assert.equal(
  hydrated?.messages.find((message) => message.id === pending.id)?.images.length,
  1
);

const completed = await updateAssistantMessageWithImages({
  messageId: pending.id,
  sessionId: session.id,
  content: "已为你生成图片。",
  status: "success",
  images: [
    {
      filePath: "/uploads/reference.png",
      mimeType: "image/png",
      sourceType: "uploaded"
    },
    {
      filePath: "/generated/result.png",
      mimeType: "image/png",
      sourceType: "generated"
    }
  ]
});

assert.equal(completed.status, "success");
assert.equal(completed.images.length, 2);
assert.equal(completed.images[1].sourceType, "generated");

const generation = await createImageGenerationMessages({
  sessionId: session.id,
  prompt: "new prompt",
  assistantContent: "图片生成任务已提交，请稍等。"
});
assert.equal(generation.userMessage.role, "user");
assert.equal(generation.assistantMessage.status, "pending");

expireStalePendingMessages({
  olderThanMs: 0,
  nowMs: Date.now() + 1000
});
hydrated = await getSessionById(session.id);
const expiredMessage = hydrated?.messages.find(
  (message) => message.id === generation.assistantMessage.id
);

assert.equal(expiredMessage?.status, "failed");
assert.equal(expiredMessage?.content, "生成任务已超时，请重新提交。");

const staleUpdate = await updateAssistantMessageWithImages({
  messageId: generation.assistantMessage.id,
  sessionId: session.id,
  content: "已为你生成图片。",
  status: "success",
  images: [
    {
      filePath: "/generated/late-result.png",
      mimeType: "image/png",
      sourceType: "generated"
    }
  ]
});
hydrated = await getSessionById(session.id);
const stillExpiredMessage = hydrated?.messages.find(
  (message) => message.id === generation.assistantMessage.id
);

assert.equal(staleUpdate, null);
assert.equal(stillExpiredMessage?.status, "failed");
assert.equal(stillExpiredMessage?.images.length, 0);

closeDbForTests();
fs.rmSync(testDbPath, { force: true });
