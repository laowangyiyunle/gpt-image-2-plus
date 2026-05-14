import type { ChatImageAsset, ChatMessage } from "@/lib/types/chat";

export type ImageResultGalleryItem = {
  id: string;
  image: ChatImageAsset;
  message: ChatMessage;
  prompt: string;
  createdAt: string;
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

    if (message.role !== "assistant" || message.status !== "success") {
      continue;
    }

    for (const image of message.images) {
      if (image.sourceType !== "generated" || image.isPending) {
        continue;
      }

      items.push({
        id: image.id,
        image,
        message,
        prompt: latestPrompt,
        createdAt: message.createdAt
      });
    }
  }

  return items.reverse();
}
