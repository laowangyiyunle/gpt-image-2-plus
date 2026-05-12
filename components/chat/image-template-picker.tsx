"use client";

import { formatMessageCreatedAt } from "@/lib/chat-message-display";
import type { ImageTemplate } from "@/lib/types/chat";

type ImageTemplatePickerProps = {
  templates: ImageTemplate[];
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onRefresh: () => void;
  onPreview: (template: ImageTemplate) => void;
  onRename: (template: ImageTemplate) => void;
  onDelete: (template: ImageTemplate) => void;
  onSelect: (template: ImageTemplate) => void;
};

export function ImageTemplatePicker({
  templates,
  loading = false,
  error,
  onClose,
  onRefresh,
  onPreview,
  onRename,
  onDelete,
  onSelect
}: ImageTemplatePickerProps) {
  return (
    <div className="template-picker-backdrop" onClick={onClose}>
      <div
        className="template-picker-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="template-picker-header">
          <div>
            <h2>选择模板</h2>
            <p>选择一张已保存的生成图，作为本次生成的参考图。</p>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        {error ? (
          <div className="template-picker-alert">
            <span>{error}</span>
            <button type="button" onClick={onRefresh}>
              重试
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="template-picker-empty">正在加载模板...</div>
        ) : templates.length === 0 ? (
          <div className="template-picker-empty">
            还没有模板。可以在生成结果下方点击“设为模板”保存常用图片。
          </div>
        ) : (
          <div className="template-picker-grid">
            {templates.map((template) => (
              <article key={template.id} className="template-picker-card">
                <button
                  type="button"
                  className="template-picker-image-button"
                  onClick={() => onPreview(template)}
                >
                  <img
                    src={template.filePath}
                    alt={template.templateName || "图片模板"}
                  />
                </button>
                <span className="template-picker-card-title">
                  {template.templateName || template.sessionTitle}
                </span>
                {template.prompt ? (
                  <span className="template-picker-card-prompt">
                    {template.prompt}
                  </span>
                ) : null}
                <span className="template-picker-card-time">
                  {formatMessageCreatedAt(template.createdAt)}
                </span>
                <div className="template-picker-card-actions">
                  <button type="button" onClick={() => onSelect(template)}>
                    使用
                  </button>
                  <button type="button" onClick={() => onPreview(template)}>
                    预览
                  </button>
                  <button type="button" onClick={() => onRename(template)}>
                    改名
                  </button>
                  <button
                    type="button"
                    className="template-picker-delete-button"
                    onClick={() => onDelete(template)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
