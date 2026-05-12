import { ChatImageActions } from "@/components/chat/chat-image-actions";
import {
  canRetryFailedMessage,
  formatMessageCreatedAt
} from "@/lib/chat-message-display";
import type { ChatImageAsset, ChatMessage } from "@/lib/types/chat";

type MessageItemProps = {
  message: ChatMessage;
  disabled?: boolean;
  onReuseImage?: (message: ChatMessage) => void;
  onRetry?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onPreviewImage?: (image: ChatImageAsset) => void;
  onToggleTemplate?: (image: ChatImageAsset, message: ChatMessage) => void;
};

export function MessageItem({
  message,
  disabled = false,
  onReuseImage,
  onRetry,
  onDelete,
  onPreviewImage,
  onToggleTemplate
}: MessageItemProps) {
  const isUser = message.role === "user";
  const isPending = message.status === "pending";
  const canRetryFailed = canRetryFailedMessage(message) && Boolean(onRetry);
  const createdAtLabel = formatMessageCreatedAt(message.createdAt);

  return (
    <article className={`message ${isUser ? "user-message" : "assistant-message"}`}>
      <div className="message-bubble">
        <div className="message-meta">
          <span className="message-meta-main">
            <span className="message-role">{isUser ? "你" : "助手"}</span>
            {createdAtLabel ? (
              <time className="message-created-at" dateTime={message.createdAt}>
                {createdAtLabel}
              </time>
            ) : null}
          </span>
          <button
            type="button"
            className="message-delete-button"
            disabled={disabled}
            onClick={() => onDelete?.(message)}
          >
            {isPending ? "取消" : "删除"}
          </button>
        </div>
        <p>{message.content}</p>
        {isPending ? (
          <div className="message-image-placeholder" aria-hidden="true">
            <div className="message-image-skeleton" />
          </div>
        ) : null}
        {isPending && message.progress ? (
          <div
            className="message-progress"
            aria-label={`生成进度 ${message.progress.percent}%`}
          >
            <div className="message-progress-meta">
              <span>{message.progress.label}</span>
              <span>
                {message.progress.percent}% · 已等待 {message.progress.elapsedSeconds}s
              </span>
            </div>
            <div className="message-progress-track">
              <div
                className="message-progress-bar"
                style={{ width: `${message.progress.percent}%` }}
              />
            </div>
          </div>
        ) : null}
        {canRetryFailed ? (
          <div className="message-failed-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRetry?.(message)}
            >
              重试
            </button>
          </div>
        ) : null}
        {!isPending ? message.images.map((image) => (
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
                    isTemplate={image.isTemplate}
                    onRetry={onRetry ? () => onRetry(message) : undefined}
                    onRefine={onReuseImage ? () => onReuseImage(message) : undefined}
                    onToggleTemplate={
                      onToggleTemplate ? () => onToggleTemplate(image, message) : undefined
                    }
                  />
                ) : (
                  <span className="message-image-tag">
                    {image.sourceType === "partial" ? "预览图" : "参考图"}
                  </span>
                )}
              </>
            )}
          </div>
        )) : null}
      </div>
    </article>
  );
}
