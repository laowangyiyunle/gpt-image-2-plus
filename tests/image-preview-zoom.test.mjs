import assert from "node:assert/strict";
import {
  clampPreviewScale,
  getNextDoubleClickScale,
  getWheelZoomState
} from "../lib/image-preview-zoom.ts";

assert.equal(clampPreviewScale(0.1), 0.5);
assert.equal(clampPreviewScale(8), 5);
assert.equal(clampPreviewScale(2.25), 2.25);

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
    scale: 1.15,
    offset: { x: -15, y: -12 }
  }
);

assert.deepEqual(
  getWheelZoomState({
    scale: 1.15,
    offset: { x: -15, y: -12 },
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
    deltaY: -100
  }).scale,
  5
);
