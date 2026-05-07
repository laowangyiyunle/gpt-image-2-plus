import { ChatImageActions } from "@/components/chat/chat-image-actions";
import type { ChatImageAsset, ChatMessage } from "@/lib/types/chat";

type MessageItemProps = {
  message: ChatMessage;
  disabled?: boolean;
  onReuseImage?: (message: ChatMessage) => void;
  onRetry?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onPreviewImage?: (image: ChatImageAsset) => void;
};

export function MessageItem({
  message,
  disabled = false,
  onReuseImage,
  onRetry,
  onDelete,
  onPreviewImage
}: MessageItemProps) {
  const isUser = message.role === "user";
  const isPending = message.status === "pending";

  return (
    <article className={`message ${isUser ? "user-message" : "assistant-message"}`}>
      <div className="message-bubble">
        <div className="message-meta">
          <span className="message-role">{isUser ? "你" : "助手"}</span>
          {!isPending ? (
            <button
              type="button"
              className="message-delete-button"
              disabled={disabled}
              onClick={() => onDelete?.(message)}
            >
              删除
            </button>
          ) : null}
        </div>
        <p>{message.content}</p>
        {message.images.map((image) => (
          <div key={image.id} className="message-image-block">
            {image.isPending ? (
              <div className="message-image-placeholder">
                <div className="message-image-skeleton" />
                <span className="message-image-loading">图片生成中...</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="message-image-preview-button"
                  onClick={() => onPreviewImage?.(image)}
                >
                  <img
                    src={image.filePath}
                    alt={image.sourceType === "uploaded" ? "参考图" : "生成结果"}
                    className="message-image"
                  />
                </button>
                {image.sourceType === "generated" ? (
                  <ChatImageActions
                    imagePath={image.filePath}
                    disabled={disabled}
                    onRetry={onRetry ? () => onRetry(message) : undefined}
                    onRefine={onReuseImage ? () => onReuseImage(message) : undefined}
                  />
                ) : (
                  <span className="message-image-tag">参考图</span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
