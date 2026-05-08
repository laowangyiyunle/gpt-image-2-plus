import assert from "node:assert/strict";
import { PROMPT_OPTIMIZER_MODEL } from "../lib/openai/prompt-model.ts";
import { optimizePromptSchema } from "../lib/validations/prompt.ts";

assert.equal(PROMPT_OPTIMIZER_MODEL, "gpt-5.4");

assert.equal(
  optimizePromptSchema.safeParse({ prompt: "一只白色水杯" }).success,
  true
);

assert.equal(optimizePromptSchema.safeParse({ prompt: "" }).success, false);
