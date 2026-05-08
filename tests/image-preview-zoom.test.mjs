import assert from "node:assert/strict";
import {
  clampPreviewScale,
  clampPreviewOffset,
  getFitPreviewScale,
  getMaxPreviewScale,
  getNextDoubleClickScale,
  getWheelZoomState
} from "../lib/image-preview-zoom.ts";

assert.equal(clampPreviewScale(0.1), 0.5);
assert.equal(clampPreviewScale(8), 5);
assert.equal(clampPreviewScale(12, 20), 12);
assert.equal(clampPreviewScale(2.25), 2.25);
assert.equal(
  getFitPreviewScale({
    image: { width: 1000, height: 5000 },
    stage: { width: 800, height: 800 }
  }),
  0.16
);
assert.equal(getMaxPreviewScale(0.16), 18.75);

assert.equal(getNextDoubleClickScale(1), 2);
assert.equal(getNextDoubleClickScale(2), 1);
assert.equal(getNextDoubleClickScale(3), 1);

assert.deepEqual(
  getWheelZoomState({
    scale: 1,
    offset: { x: 0, y: 0 },
    pointer: { x: 100, y: 80 },
    deltaY: -100
  }),
  {
    scale: 1.18,
    offset: { x: -18, y: -14.4 }
  }
);

assert.deepEqual(
  getWheelZoomState({
    scale: 1.18,
    offset: { x: -18, y: -14.4 },
    pointer: { x: 100, y: 80 },
    deltaY: 100
  }),
  {
    scale: 1,
    offset: { x: 0, y: 0 }
  }
);

assert.equal(
  getWheelZoomState({
    scale: 5,
    offset: { x: 0, y: 0 },
    pointer: { x: 100, y: 80 },
    deltaY: -100,
    maxScale: 18
  }).scale,
  5.9
);

assert.deepEqual(
  clampPreviewOffset({
    offset: { x: 500, y: -900 },
    scale: 2,
    baseSize: { width: 300, height: 800 },
    stageSize: { width: 500, height: 600 }
  }),
  {
    x: 50,
    y: -500
  }
);
