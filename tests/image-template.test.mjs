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
  deleteMessageById,
  getSessionById,
  hardDeleteMessageById,
  listImageTemplates,
  listDeletedMessages,
  restoreMessageById,
  updateAssistantMessageWithImages,
  updateImageTemplate
} = await import("../lib/services/session-service.ts");
const { closeDbForTests } = await import("../lib/db/sqlite.ts");

const session = await createSession("Template test prompt");
const pending = await createPendingAssistantMessage({
  sessionId: session.id,
  content: "Image generation task submitted."
});
const completed = await updateAssistantMessageWithImages({
  messageId: pending.id,
  sessionId: session.id,
  content: "Generated image.",
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
  templateName: "Poster template",
  templatePrompt: "Custom template prompt"
});

let templates = await listImageTemplates();

assert.equal(templates.length, 1);
assert.equal(templates[0].id, generatedImage.id);
assert.equal(templates[0].templateName, "Poster template");
assert.equal(templates[0].templatePrompt, "Custom template prompt");
assert.equal(templates[0].prompt, "Custom template prompt");
assert.equal(templates[0].sessionTitle, "Template test prompt");

let hydrated = await getSessionById(session.id);
assert.equal(hydrated?.messages[0].images[0].isTemplate, true);
assert.equal(hydrated?.messages[0].images[0].templatePrompt, "Custom template prompt");

const deletedMessage = await deleteMessageById(completed.id);
assert.equal(deletedMessage?.messageId, completed.id);

templates = await listImageTemplates();
assert.equal(templates.length, 1);
assert.equal(templates[0].id, generatedImage.id);
assert.equal(templates[0].filePath, "/generated/template-source.png");
assert.equal(templates[0].templatePrompt, "Custom template prompt");

let trashMessages = await listDeletedMessages(session.id);
assert.equal(trashMessages.length, 1);
assert.equal(trashMessages[0].id, completed.id);
assert.equal(trashMessages[0].images[0].filePath, "/generated/template-source.png");

const restoredMessage = await restoreMessageById(completed.id);
assert.equal(restoredMessage?.messageId, completed.id);

trashMessages = await listDeletedMessages(session.id);
assert.equal(trashMessages.length, 0);
hydrated = await getSessionById(session.id);
assert.equal(hydrated?.messages.length, 1);

await deleteMessageById(completed.id);

const hardDeletedMessage = await hardDeleteMessageById(completed.id);
assert.equal(hardDeletedMessage?.messageId, completed.id);

trashMessages = await listDeletedMessages(session.id);
assert.equal(trashMessages.length, 0);
hydrated = await getSessionById(session.id);
assert.equal(hydrated?.messages.length, 0);
templates = await listImageTemplates();
assert.equal(templates.length, 1);
assert.equal(templates[0].filePath, "/generated/template-source.png");

await updateImageTemplate({
  imageId: generatedImage.id,
  isTemplate: false
});
templates = await listImageTemplates();
hydrated = await getSessionById(session.id);

assert.equal(templates.length, 0);
assert.equal(hydrated?.messages.length, 0);

closeDbForTests();
fs.rmSync(testDbPath, { force: true });
