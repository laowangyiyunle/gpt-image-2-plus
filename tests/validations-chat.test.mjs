import assert from "node:assert/strict";
import {
  createSessionSchema,
  editImageSchema,
  generateImageSchema
} from "../lib/validations/chat.ts";

const longPrompt = "生成一张用于首条消息回归测试的长提示词。".repeat(20);

assert.equal(
  createSessionSchema.safeParse({ title: longPrompt }).success,
  true,
  "session creation should accept a long first prompt and derive the title later"
);

assert.equal(
  generateImageSchema.safeParse({
    sessionId: "session-1",
    prompt: "测试",
    size: "2048x2048",
    quality: "auto",
    count: 1
  }).success,
  false,
  "text-to-image should reject unsupported image size values"
);

assert.equal(
  editImageSchema.safeParse({
    sessionId: "session-1",
    prompt: "测试",
    size: "auto",
    quality: "high",
    count: "2"
  }).success,
  true,
  "image edit should coerce form-data count with the same shared parameter schema"
);

assert.equal(
  editImageSchema.safeParse({
    sessionId: "session-1",
    prompt: "测试",
    size: "auto",
    quality: "ultra",
    count: "2"
  }).success,
  false,
  "image edit should reject unsupported quality values"
);
