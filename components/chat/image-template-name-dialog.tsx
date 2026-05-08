"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChatImageAsset, ImageTemplate } from "@/lib/types/chat";

type TemplateNameImage = Pick<
  ChatImageAsset | ImageTemplate,
  "filePath" | "templateName"
>;

type ImageTemplateNameDialogProps = {
  image: TemplateNameImage;
  title?: string;
  description?: string;
  submitLabel?: string;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (templateName: string) => void;
};

export function ImageTemplateNameDialog({
  image,
  title = "设为模板",
  description = "给这张生成图起一个名字，后续可以在输入区选择使用。",
  submitLabel = "保存模板",
  saving = false,
  error,
  onClose,
  onSubmit
}: ImageTemplateNameDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [templateName, setTemplateName] = useState(image.templateName ?? "");

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(templateName);
  }

  return (
    <div className="template-name-backdrop" onClick={onClose}>
      <form
        className="template-name-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="template-name-header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving}>
            关闭
          </button>
        </div>

        <img
          src={image.filePath}
          alt="模板预览"
          className="template-name-preview"
        />

        <label className="template-name-field">
          <span>模板名称</span>
          <input
            ref={inputRef}
            value={templateName}
            maxLength={80}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="可留空，默认使用会话标题"
            disabled={saving}
          />
        </label>

        {error ? <p className="template-name-error">{error}</p> : null}

        <div className="template-name-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "保存中..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
