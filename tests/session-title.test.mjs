import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const testDbPath = path.resolve(
  `tmp/session-title.${process.pid}.${Date.now()}.test.db`
);
process.env.DATABASE_URL = `file:${testDbPath}`;

const {
  createImageGenerationMessages,
  createSession,
  getSessionById,
  listSessions
} = await import("../lib/services/session-service.ts");
const { closeDbForTests } = await import("../lib/db/sqlite.ts");

const emptySession = await createSession();
assert.notEqual(emptySession.title, "minimal product poster with soft light");

await createImageGenerationMessages({
  sessionId: emptySession.id,
  prompt: "minimal product poster with soft light",
  assistantContent: "generation pending"
});

const hydrated = await getSessionById(emptySession.id);
assert.equal(hydrated?.title, "minimal product poster with so");

const sessions = await listSessions();
assert.equal(sessions[0].title, "minimal product poster with so");

const titledSession = await createSession("already titled prompt");
await createImageGenerationMessages({
  sessionId: titledSession.id,
  prompt: "different first prompt",
  assistantContent: "generation pending"
});

const titledHydrated = await getSessionById(titledSession.id);
assert.equal(titledHydrated?.title, "already titled prompt");

closeDbForTests();
fs.rmSync(testDbPath, { force: true });
