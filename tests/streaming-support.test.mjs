import assert from "node:assert/strict";
import { isStreamingUnsupportedError } from "../lib/openai/streaming-support.ts";

assert.equal(
  isStreamingUnsupportedError(new Error("stream is unsupported for this model")),
  true
);

assert.equal(isStreamingUnsupportedError(new Error("invalid api key")), false);
