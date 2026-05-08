type ChatImageActionsProps = {
  imagePath: string;
  disabled?: boolean;
  isTemplate?: boolean;
  onRetry?: () => void;
  onRefine?: () => void;
  onToggleTemplate?: () => void;
};

export function ChatImageActions({
  imagePath,
  disabled = false,
  isTemplate = false,
  onRetry,
  onRefine,
  onToggleTemplate
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
      <button type="button" onClick={onToggleTemplate} disabled={disabled}>
        {isTemplate ? "取消模板" : "设为模板"}
      </button>
    </div>
  );
}
