import type { ChatMessage } from "@/lib/types/chat";

type NotificationMessage = Pick<
  ChatMessage,
  "id" | "role" | "status" | "images" | "content"
>;

export type GenerationNotification = {
  messageId: string;
  title: string;
  body: string;
};

export function getPendingGenerationNotificationIds(
  messages: NotificationMessage[]
) {
  return new Set(
    messages
      .filter(
        (message) => message.role === "assistant" && message.status === "pending"
      )
      .map((message) => message.id)
  );
}

export function collectCompletedGenerationNotifications(
  previousPendingIds: ReadonlySet<string>,
  messages: NotificationMessage[]
): GenerationNotification[] {
  return messages.flatMap((message) => {
    if (
      message.role !== "assistant" ||
      !previousPendingIds.has(message.id) ||
      (message.status !== "success" && message.status !== "failed")
    ) {
      return [];
    }

    if (message.status === "failed") {
      return [
        {
          messageId: message.id,
          title: "图片生成失败",
          body: message.content || "生成失败，请回到页面查看原因。"
        }
      ];
    }

    const generatedCount = message.images.filter(
      (image) => image.sourceType === "generated" && !image.isPending
    ).length;

    return [
      {
        messageId: message.id,
        title: "图片生成完成",
        body:
          generatedCount > 0
            ? `已生成 ${generatedCount} 张图片，回到页面查看结果。`
            : "图片已生成，回到页面查看结果。"
      }
    ];
  });
}
