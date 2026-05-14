import type { ChatImageAsset, ChatMessage } from "@/lib/types/chat";

export type ImageResultGalleryItem = {
  id: string;
  kind: "generated" | "generating";
  image: ChatImageAsset;
  message: ChatMessage;
  prompt: string;
  createdAt: string;
};

export type ImageResultGalleryStats = {
  generatedCount: number;
  generatingCount: number;
  totalMessages: number;
  isGenerating: boolean;
};

export function getImageResultGalleryItems(
  messages: ChatMessage[]
): ImageResultGalleryItem[] {
  const items: ImageResultGalleryItem[] = [];
  let latestPrompt = "";

  for (const message of messages) {
    if (message.role === "user" && message.content.trim()) {
      latestPrompt = message.content.trim();
      continue;
    }

    if (message.role !== "assistant") {
      continue;
    }

    if (message.status === "pending") {
      items.push({
        id: message.id,
        kind: "generating",
        image:
          message.images.find((image) => image.isPending) ??
          message.images[0] ?? {
            id: `${message.id}-pending-image`,
            filePath: "",
            mimeType: "image/png",
            sourceType: "generated",
            isPending: true
          },
        message,
        prompt: latestPrompt,
        createdAt: message.createdAt
      });
      continue;
    }

    if (message.status !== "success") {
      continue;
    }

    for (const image of message.images) {
      if (image.sourceType !== "generated" || image.isPending) {
        continue;
      }

      items.push({
        id: image.id,
        kind: "generated",
        image,
        message,
        prompt: latestPrompt,
        createdAt: message.createdAt
      });
    }
  }

  return items.reverse();
}

export function getImageResultGalleryStats(
  messages: ChatMessage[]
): ImageResultGalleryStats {
  const generatedCount = getImageResultGalleryItems(messages).filter(
    (item) => item.kind === "generated"
  ).length;
  const generatingCount = messages.filter(
    (message) => message.role === "assistant" && message.status === "pending"
  ).length;

  return {
    generatedCount,
    generatingCount,
    totalMessages: messages.length,
    isGenerating: generatingCount > 0
  };
}
