import assert from "node:assert/strict";
import {
  getFinalizingGenerationProgress,
  getInitialGenerationProgress,
  getPartialImageProgress
} from "../lib/generation-progress.ts";

assert.deepEqual(
  getInitialGenerationProgress({ elapsedSeconds: 1, hasReferenceImage: false }),
  {
    percent: 10,
    label: "等待首张预览图",
    elapsedSeconds: 1
  }
);

assert.deepEqual(
  getInitialGenerationProgress({ elapsedSeconds: 2, hasReferenceImage: true }),
  {
    percent: 10,
    label: "等待生成预览",
    elapsedSeconds: 2
  }
);

assert.deepEqual(
  getPartialImageProgress({ partialImageIndex: 0, elapsedSeconds: 16 }),
  {
    percent: 45,
    label: "已收到第 1 张预览图",
    elapsedSeconds: 16
  }
);

assert.equal(
  getPartialImageProgress({ partialImageIndex: 2, elapsedSeconds: 30 }).percent,
  85
);

assert.equal(
  getFinalizingGenerationProgress({ elapsedSeconds: 90 }).percent,
  95
);
