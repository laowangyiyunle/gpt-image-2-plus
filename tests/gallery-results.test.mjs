import assert from "node:assert/strict";
import {
  getImageResultGalleryItems,
  getImageResultGalleryStats
} from "../lib/gallery-results.ts";

const messages = [
  {
    id: "user-1",
    role: "user",
    content: "生成一张蓝色科技海报",
    status: "success",
    createdAt: "2026-05-13T01:00:00.000Z",
    images: []
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "图片生成完成。",
    status: "success",
    createdAt: "2026-05-13T01:01:00.000Z",
    images: [
      {
        id: "uploaded-1",
        filePath: "/uploads/reference.png",
        mimeType: "image/png",
        sourceType: "uploaded"
      },
      {
        id: "generated-1",
        filePath: "/generated/result-1.png",
        mimeType: "image/png",
        sourceType: "generated",
        isTemplate: true,
        templateName: "科技海报"
      }
    ]
  },
  {
    id: "user-2",
    role: "user",
    content: "再做一版更简洁的",
    status: "success",
    createdAt: "2026-05-13T01:02:00.000Z",
    images: []
  },
  {
    id: "assistant-2",
    role: "assistant",
    content: "图片生成中。",
    status: "pending",
    createdAt: "2026-05-13T01:03:00.000Z",
    images: [
      {
        id: "generated-pending",
        filePath: "/generated/pending.png",
        mimeType: "image/png",
        sourceType: "generated",
        isPending: true
      }
    ]
  }
];

const items = getImageResultGalleryItems(messages);

assert.equal(items.length, 2);
assert.equal(items[0].id, "assistant-2");
assert.equal(items[0].kind, "generating");
assert.equal(items[0].prompt, "再做一版更简洁的");
assert.equal(items[0].message.id, "assistant-2");

assert.equal(items[1].id, "generated-1");
assert.equal(items[1].kind, "generated");
assert.equal(items[1].prompt, "生成一张蓝色科技海报");
assert.equal(items[1].message.id, "assistant-1");
assert.equal(items[1].image.filePath, "/generated/result-1.png");

const stats = getImageResultGalleryStats(messages);

assert.equal(stats.generatedCount, 1);
assert.equal(stats.generatingCount, 1);
assert.equal(stats.totalMessages, 4);
assert.equal(stats.isGenerating, true);
