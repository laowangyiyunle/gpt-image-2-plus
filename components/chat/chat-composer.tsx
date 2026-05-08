"use client";

import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState
} from "react";

export type ComposerDraft = {
  file: File | null;
  focus?: boolean;
  prompt?: string;
  version: number;
};

type ChatComposerProps = {
  activeSessionId: string | null;
  draft?: ComposerDraft | null;
  initialPrompt?: string;
  disabled?: boolean;
  onOpenTemplatePicker?: () => void;
  onSubmitted: (args: {
    prompt: string;
    imageFile: File | null;
    size: string;
    quality: string;
    count: number;
  }) => Promise<void>;
};

export function ChatComposer({
  activeSessionId: _activeSessionId,
  draft,
  initialPrompt,
  disabled = false,
  onOpenTemplatePicker,
  onSubmitted
}: ChatComposerProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [size, setSize] = useState("auto");
  const [quality, setQuality] = useState("auto");
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!draft) {
      return;
    }

    setSelectedImage(draft.file);

    if (draft.prompt !== undefined) {
      setPrompt(draft.prompt);
    }

    if (draft.focus) {
      textareaRef.current?.focus();
    }
  }, [draft]);

  function updatePreview(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }

  function syncFileInput(file: File | null) {
    if (!fileInputRef.current) {
      return;
    }

    if (!file) {
      fileInputRef.current.value = "";
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInputRef.current.files = dataTransfer.files;
  }

  function setSelectedImage(file: File | null) {
    setSelectedImageFile(file);
    setSelectedFileName(file?.name ?? "");
    updatePreview(file);
    syncFileInput(file);
  }

  function clearSelectedImage() {
    setSelectedImage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    const imageFile = selectedImageFile;

    if (!trimmedPrompt) {
      setError("请输入图片描述。");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setPrompt("");
      clearSelectedImage();
      formRef.current?.reset();
      await onSubmitted({ prompt: trimmedPrompt, imageFile, size, quality, count });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "生成失败，请稍后重试。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.ctrlKey) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  function handlePromptPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );

    if (!imageItem) {
      return;
    }

    const pastedImage = imageItem.getAsFile();

    if (!pastedImage) {
      return;
    }

    event.preventDefault();

    const fileName =
      pastedImage.name && pastedImage.name.trim()
        ? pastedImage.name
        : `pasted-image.${pastedImage.type.split("/")[1] || "png"}`;

    const normalizedImage = new File([pastedImage], fileName, {
      type: pastedImage.type
    });

    setSelectedImage(normalizedImage);
  }

  async function handleOptimizePrompt() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError("请先输入要优化的提示词。");
      textareaRef.current?.focus();
      return;
    }

    try {
      setOptimizing(true);
      setError(null);
      const response = await fetch("/api/prompts/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: trimmedPrompt })
      });
      const data = (await response.json().catch(() => ({}))) as {
        prompt?: string;
        error?: string;
      };

      if (!response.ok || !data.prompt) {
        throw new Error(data.error || "优化失败，请稍后重试。");
      }

      setPrompt(data.prompt);
      textareaRef.current?.focus();
    } catch (optimizeError) {
      setError(
        optimizeError instanceof Error
          ? optimizeError.message
          : "优化失败，请稍后重试。"
      );
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <form ref={formRef} className="chat-composer" onSubmit={handleSubmit}>
      <label className="composer-textarea-label">
        <span className="composer-label-row">
          <span>输入提示词</span>
          <button
            type="button"
            className="prompt-optimize-button"
            disabled={disabled || submitting || optimizing}
            onClick={() => void handleOptimizePrompt()}
          >
            {optimizing ? "优化中..." : "优化提示词"}
          </button>
        </span>
        <textarea
          ref={textareaRef}
          name="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handlePromptKeyDown}
          onPaste={handlePromptPaste}
          disabled={disabled || submitting || optimizing}
          placeholder="请输入你想生成的图片内容，支持中文描述。按 Enter 发送，Ctrl + Enter 换行，也支持直接粘贴图片。"
          rows={3}
        />
      </label>

      <div className="composer-params-row">
        <label className="composer-param">
          <span>尺寸</span>
          <select
            value={size}
            onChange={(event) => setSize(event.target.value)}
            disabled={disabled || submitting || optimizing}
          >
            <option value="auto">自动</option>
            <option value="1024x1024">方图</option>
            <option value="1536x1024">横图</option>
            <option value="1024x1536">竖图</option>
          </select>
        </label>
        <label className="composer-param">
          <span>质量</span>
          <select
            value={quality}
            onChange={(event) => setQuality(event.target.value)}
            disabled={disabled || submitting || optimizing}
          >
            <option value="auto">自动</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </label>
        <label className="composer-param">
          <span>张数</span>
          <input
            type="number"
            min={1}
            max={4}
            value={count}
            onChange={(event) => {
              const nextValue = Number(event.target.value) || 1;
              setCount(Math.max(1, Math.min(4, nextValue)));
            }}
            disabled={disabled || submitting || optimizing}
          />
        </label>
      </div>

      {previewUrl ? (
        <div className="composer-preview-card">
          <img
            src={previewUrl}
            alt={selectedFileName || "参考图预览"}
            className="composer-preview-image"
          />
          <div className="composer-preview-meta">
            <span className="composer-preview-name">
              {selectedFileName || "参考图预览"}
            </span>
            <button
            type="button"
            className="composer-preview-remove"
            onClick={clearSelectedImage}
            disabled={disabled || submitting || optimizing}
          >
            删除参考图
          </button>
          </div>
        </div>
      ) : null}

      <div className="composer-actions-row">
        <label className="file-picker">
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
            disabled={disabled || submitting || optimizing}
          />
          <span>{previewUrl ? "重新选择参考图" : "上传参考图"}</span>
        </label>
        <button
          type="button"
          className="template-picker-open-button"
          onClick={onOpenTemplatePicker}
          disabled={disabled || submitting || optimizing}
        >
          选择模板
        </button>
        <span className="selected-file-name">
          {selectedFileName || "未选择文件"}
        </span>
        <button type="submit" disabled={disabled || submitting || optimizing}>
          {submitting ? "生成中..." : "发送生成"}
        </button>
      </div>

      {error ? <p className="composer-error">{error}</p> : null}
    </form>
  );
}
