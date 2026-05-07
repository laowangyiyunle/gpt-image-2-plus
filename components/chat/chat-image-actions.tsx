type ChatImageActionsProps = {
  imagePath: string;
  disabled?: boolean;
  onRetry?: () => void;
  onRefine?: () => void;
};

export function ChatImageActions({
  imagePath,
  disabled = false,
  onRetry,
  onRefine
}: ChatImageActionsProps) {
  return (
    <div className="message-image-actions">
      <a href={imagePath} download>
        下载图片
      </a>
      <button type="button" onClick={onRetry} disabled={disabled}>
        重新生成
      </button>
      <button type="button" onClick={onRefine} disabled={disabled}>
        继续细化
      </button>
    </div>
  );
}
