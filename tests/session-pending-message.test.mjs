import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const testDbPath = path.resolve(
  `tmp/session-pending-message.${process.pid}.${Date.now()}.test.db`
);
process.env.DATABASE_URL = `file:${testDbPath}`;

const {
  createPendingAssistantMessage,
  createSession,
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

closeDbForTests();
fs.rmSync(testDbPath, { force: true });
