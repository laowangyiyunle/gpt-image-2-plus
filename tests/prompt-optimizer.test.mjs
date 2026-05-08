import assert from "node:assert/strict";
import { optimizeImagePrompt } from "../lib/prompt-optimizer.ts";

assert.equal(optimizeImagePrompt("  "), "");

const optimized = optimizeImagePrompt("一只白色水杯放在木桌上");

assert.ok(optimized.includes("一只白色水杯放在木桌上"));
assert.ok(optimized.includes("主体与内容"));
assert.ok(optimized.includes("构图与镜头"));
assert.ok(optimized.includes("光影与质感"));
assert.ok(optimized.includes("避免低清晰度"));

assert.equal(
  optimizeImagePrompt("主体与内容：一只白色水杯\n构图与镜头：居中构图"),
  "主体与内容：一只白色水杯\n构图与镜头：居中构图"
);
