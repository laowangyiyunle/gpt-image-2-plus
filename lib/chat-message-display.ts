import {
  getInitialGenerationProgress,
  withElapsedSeconds
} from "./generation-progress.ts";
import type { ChatMessage } from "./types/chat.ts";

export function getElapsedSecondsAt(createdAt: string, nowMs = Date.now()) {
  const startedAt = Date.parse(createdAt);

  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowMs - startedAt) / 1000));
}

export function formatMessageCreatedAt(createdAt: string) {
  const date = new Date(createdAt);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function canRetryFailedMessage(
  message: Pick<ChatMessage, "role" | "status">
) {
  return message.role === "assistant" && message.status === "failed";
}

export function withRecoverablePendingProgressAt(
  messages: ChatMessage[],
  nowMs = Date.now()
) {
  return messages.map((message) => {
    if (message.role !== "assistant" || message.status !== "pending") {
      return message;
    }

    const elapsedSeconds = getElapsedSecondsAt(message.createdAt, nowMs);
    const hasReferenceImage = message.images.some(
      (image) => image.sourceType === "uploaded"
    );

    return {
      ...message,
      progress: message.progress
        ? withElapsedSeconds(message.progress, elapsedSeconds)
        : getInitialGenerationProgress({
            elapsedSeconds,
            hasReferenceImage
          })
    };
  });
}
