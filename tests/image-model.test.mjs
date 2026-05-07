import assert from "node:assert/strict";
import { IMAGE_GENERATION_MODEL } from "../lib/openai/image-model.ts";

assert.equal(
  IMAGE_GENERATION_MODEL,
  "gpt-image-2",
  "image generation and edit requests should use gpt-image-2"
);
