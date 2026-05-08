import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const testDbPath = path.resolve(
  `tmp/image-template.${process.pid}.${Date.now()}.test.db`
);
process.env.DATABASE_URL = `file:${testDbPath}`;

const {
  createPendingAssistantMessage,
  createSession,
  getSessionById,
  listImageTemplates,
  updateAssistantMessageWithImages,
  updateImageTemplate
} = await import("../lib/services/session-service.ts");
const { closeDbForTests } = await import("../lib/db/sqlite.ts");

const session = await createSession("模板测试提示词");
const pending = await createPendingAssistantMessage({
  sessionId: session.id,
  content: "图片生成任务已提交，请稍等。"
});
const completed = await updateAssistantMessageWithImages({
  messageId: pending.id,
  sessionId: session.id,
  content: "已为你生成图片。",
  status: "success",
  images: [
    {
      filePath: "/generated/template-source.png",
      mimeType: "image/png",
      sourceType: "generated"
    }
  ]
});
const generatedImage = completed.images[0];

await updateImageTemplate({
  imageId: generatedImage.id,
  isTemplate: true,
  templateName: "海报模板",
  templatePrompt: "自定义模板提示词"
});

let templates = await listImageTemplates();

assert.equal(templates.length, 1);
assert.equal(templates[0].id, generatedImage.id);
assert.equal(templates[0].templateName, "海报模板");
assert.equal(templates[0].templatePrompt, "自定义模板提示词");
assert.equal(templates[0].prompt, "自定义模板提示词");
assert.equal(templates[0].sessionTitle, "模板测试提示词");

let hydrated = await getSessionById(session.id);
assert.equal(hydrated?.messages[0].images[0].isTemplate, true);
assert.equal(hydrated?.messages[0].images[0].templatePrompt, "自定义模板提示词");

await updateImageTemplate({
  imageId: generatedImage.id,
  isTemplate: false
});
templates = await listImageTemplates();
hydrated = await getSessionById(session.id);

assert.equal(templates.length, 0);
assert.equal(hydrated?.messages[0].images[0].isTemplate, false);

closeDbForTests();
fs.rmSync(testDbPath, { force: true });
