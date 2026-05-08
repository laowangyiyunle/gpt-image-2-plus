"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChatImageAsset, ImageTemplate } from "@/lib/types/chat";

type TemplateNameImage = Pick<
  ChatImageAsset | ImageTemplate,
  "filePath" | "templateName"
>;

type PromptOption = {
  id: string;
  content: string;
  createdAt: string;
};

type ImageTemplateNameDialogProps = {
  image: TemplateNameImage;
  initialPrompt?: string;
  promptOptions?: PromptOption[];
  selectedPromptIds?: string[];
  title?: string;
  description?: string;
  submitLabel?: string;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (args: { templateName: string; templatePrompt: string }) => void;
};

function promptFromSelection(options: PromptOption[], selectedIds: string[]) {
  return options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.content)
    .join("\n\n");
}

export function ImageTemplateNameDialog({
  image,
  initialPrompt = "",
  promptOptions = [],
  selectedPromptIds = [],
  title = "设为模板",
  description = "给这张生成图起一个名字，并选择下次复用时带入的提示词。",
  submitLabel = "保存模板",
  saving = false,
  error,
  onClose,
  onSubmit
}: ImageTemplateNameDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [templateName, setTemplateName] = useState(image.templateName ?? "");
  const [templatePrompt, setTemplatePrompt] = useState(initialPrompt);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedPromptIds);
  const [draftSelectedIds, setDraftSelectedIds] =
    useState<string[]>(selectedPromptIds);
  const [isPromptPickerOpen, setIsPromptPickerOpen] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ templateName, templatePrompt });
  }

  function openPromptPicker() {
    setDraftSelectedIds(selectedIds);
    setIsPromptPickerOpen(true);
  }

  function confirmPromptSelection() {
    setSelectedIds(draftSelectedIds);
    setTemplatePrompt(promptFromSelection(promptOptions, draftSelectedIds));
    setIsPromptPickerOpen(false);
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

        <div className="template-name-body">
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

          {promptOptions.length > 0 ? (
            <div className="template-prompt-summary">
              <div>
                <span>提示词内容</span>
                <p>
                  {selectedIds.length > 0
                    ? `已选择 ${selectedIds.length} 条聊天内容`
                    : "未选择聊天内容，可手动编辑下方提示词"}
                </p>
              </div>
              <button
                type="button"
                onClick={openPromptPicker}
                disabled={saving}
              >
                选择
              </button>
            </div>
          ) : null}

          <label className="template-name-field">
            <span>模板提示词</span>
            <textarea
              value={templatePrompt}
              maxLength={4000}
              rows={4}
              onChange={(event) => setTemplatePrompt(event.target.value)}
              placeholder="选择模板时会自动带入输入框，可留空"
              disabled={saving}
            />
          </label>

          {error ? <p className="template-name-error">{error}</p> : null}
        </div>

        <div className="template-name-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "保存中..." : submitLabel}
          </button>
        </div>
      </form>

      {isPromptPickerOpen ? (
        <div
          className="template-prompt-picker-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            setIsPromptPickerOpen(false);
          }}
        >
          <div
            className="template-prompt-picker-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="template-prompt-picker-header">
              <div>
                <h3>选择提示词内容</h3>
                <p>勾选一条或多条聊天内容，确认后会写入模板提示词。</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPromptPickerOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="template-prompt-picker-list">
              {promptOptions.map((option) => (
                <label key={option.id} className="template-prompt-option">
                  <input
                    type="checkbox"
                    checked={draftSelectedIds.includes(option.id)}
                    onChange={(event) => {
                      setDraftSelectedIds((current) =>
                        event.target.checked
                          ? [...current, option.id]
                          : current.filter((id) => id !== option.id)
                      );
                    }}
                  />
                  <span>{option.content}</span>
                </label>
              ))}
            </div>

            <div className="template-prompt-picker-actions">
              <button
                type="button"
                onClick={() => {
                  setDraftSelectedIds([]);
                }}
              >
                清空
              </button>
              <button
                type="button"
                onClick={() => setIsPromptPickerOpen(false)}
              >
                取消
              </button>
              <button type="button" onClick={confirmPromptSelection}>
                确认选择
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
