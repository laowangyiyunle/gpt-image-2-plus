import assert from "node:assert/strict";
import {
  canRetryFailedMessage,
  getElapsedSecondsAt,
  withRecoverablePendingProgressAt
} from "../lib/chat-message-display.ts";

const createdAt = "2026-05-08T10:00:00.000Z";

assert.equal(
  getElapsedSecondsAt(createdAt, Date.parse("2026-05-08T10:00:01.000Z")),
  1
);

assert.equal(
  getElapsedSecondsAt(createdAt, Date.parse("2026-05-08T10:00:02.000Z")),
  2
);

const [firstTick] = withRecoverablePendingProgressAt(
  [
    {
      id: "message-1",
      role: "assistant",
      content: "图片生成任务已提交，请稍等。",
      status: "pending",
      createdAt,
      images: []
    }
  ],
  Date.parse("2026-05-08T10:00:01.000Z")
);

const [secondTick] = withRecoverablePendingProgressAt(
  [
    {
      ...firstTick,
      progress: firstTick.progress
    }
  ],
  Date.parse("2026-05-08T10:00:02.000Z")
);

assert.equal(firstTick.progress?.elapsedSeconds, 1);
assert.equal(secondTick.progress?.elapsedSeconds, 2);

assert.equal(
  canRetryFailedMessage({
    role: "assistant",
    status: "failed"
  }),
  true
);

assert.equal(
  canRetryFailedMessage({
    role: "assistant",
    status: "pending"
  }),
  false
);

assert.equal(
  canRetryFailedMessage({
    role: "user",
    status: "failed"
  }),
  false
);
