import assert from "node:assert/strict";
import {
  collectCompletedGenerationNotifications,
  getPendingGenerationNotificationIds
} from "../lib/generation-notifications.ts";

const baseMessage = {
  role: "assistant",
  content: "",
  images: [],
  createdAt: "2026-05-14T00:00:00.000Z"
};

const pendingIds = getPendingGenerationNotificationIds([
  {
    ...baseMessage,
    id: "assistant-1",
    status: "pending"
  },
  {
    ...baseMessage,
    id: "user-1",
    role: "user",
    status: "success"
  },
  {
    ...baseMessage,
    id: "assistant-2",
    status: "success"
  }
]);

assert.deepEqual([...pendingIds], ["assistant-1"]);

const notifications = collectCompletedGenerationNotifications(pendingIds, [
  {
    ...baseMessage,
    id: "assistant-1",
    status: "success",
    images: [
      {
        id: "uploaded-1",
        filePath: "/uploads/source.png",
        mimeType: "image/png",
        sourceType: "uploaded"
      },
      {
        id: "generated-1",
        filePath: "/generated/result-1.png",
        mimeType: "image/png",
        sourceType: "generated"
      },
      {
        id: "generated-2",
        filePath: "/generated/result-2.png",
        mimeType: "image/png",
        sourceType: "generated"
      }
    ]
  },
  {
    ...baseMessage,
    id: "assistant-3",
    status: "failed",
    content: "生成失败，请稍后重试。"
  }
]);

assert.deepEqual(notifications, [
  {
    messageId: "assistant-1",
    title: "图片生成完成",
    body: "已生成 2 张图片，回到页面查看结果。"
  }
]);

const failedNotifications = collectCompletedGenerationNotifications(
  new Set(["assistant-3"]),
  [
    {
      ...baseMessage,
      id: "assistant-3",
      status: "failed",
      content: "生成失败，请稍后重试。"
    }
  ]
);

assert.deepEqual(failedNotifications, [
  {
    messageId: "assistant-3",
    title: "图片生成失败",
    body: "生成失败，请稍后重试。"
  }
]);
