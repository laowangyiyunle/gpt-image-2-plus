import { ChatImageActions } from "@/components/chat/chat-image-actions";
import { formatMessageCreatedAt } from "@/lib/chat-message-display";
import type { ImageResultGalleryItem } from "@/lib/gallery-results";

type ImageResultGalleryProps = {
  items: ImageResultGalleryItem[];
  disabled?: boolean;
  onPreview: (item: ImageResultGalleryItem) => void;
  onRetry: (item: ImageResultGalleryItem) => void;
  onRefine: (item: ImageResultGalleryItem) => void;
  onToggleTemplate: (item: ImageResultGalleryItem) => void;
  onDelete: (item: ImageResultGalleryItem) => void;
};

export function ImageResultGallery({
  items,
  disabled = false,
  onPreview,
  onRetry,
  onRefine,
  onToggleTemplate,
  onDelete
}: ImageResultGalleryProps) {
  if (items.length === 0) {
    return (
      <section className="image-gallery image-gallery-empty">
        <div>
          <h2>开始创作图片</h2>
          <p>在右侧填写提示词、参考图和参数，生成结果会优先展示在这里。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="image-gallery" aria-label="生成结果画廊">
      {items.map((item) => {
        const isGenerating = item.kind === "generating";

        return (
          <article
            key={item.id}
            className={`image-result-card ${
              isGenerating ? "image-result-card-generating" : ""
            }`}
          >
            {isGenerating ? (
              <div className="image-result-generating-preview" aria-hidden="true">
                <div className="message-image-skeleton" />
                <span>生成中...</span>
              </div>
            ) : (
              <button
                type="button"
                className="image-result-preview-button"
                onClick={() => onPreview(item)}
              >
                <img
                  src={item.image.filePath}
                  alt={item.prompt || "生成结果"}
                  className="image-result-preview"
                />
              </button>
            )}
            <div className="image-result-meta">
              <p>{item.prompt || "未记录提示词"}</p>
              <span>
                {formatMessageCreatedAt(item.createdAt)}
                {item.message.progress
                  ? ` · ${item.message.progress.percent}%`
                  : ""}
              </span>
            </div>
            <div className="image-result-card-footer">
              <span>
                {isGenerating
                  ? "正在生成"
                  : item.image.isTemplate
                    ? "已保存为模板"
                    : "生成结果"}
              </span>
              <button
                type="button"
                className="image-result-delete-button"
                disabled={disabled}
                onClick={() => onDelete(item)}
              >
                {isGenerating ? "取消" : "删除"}
              </button>
            </div>
            {isGenerating ? null : (
              <ChatImageActions
                imagePath={item.image.filePath}
                disabled={disabled}
                isTemplate={item.image.isTemplate}
                onRetry={() => onRetry(item)}
                onRefine={() => onRefine(item)}
                onToggleTemplate={() => onToggleTemplate(item)}
              />
            )}
          </article>
        );
      })}
    </section>
  );
}
