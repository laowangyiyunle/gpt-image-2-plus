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
  file?: File | null;
  files?: File[];
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
    imageFiles: File[];
    size: string;
    quality: string;
    count: number;
  }) => Promise<void>;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
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
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [size, setSize] = useState("auto");
  const [quality, setQuality] = useState("auto");
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const previewUrl of previewUrlsRef.current) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!draft) {
      return;
    }

    setSelectedReferenceImages(draft.files ?? (draft.file ? [draft.file] : []));

    if (draft.prompt !== undefined) {
      setPrompt(draft.prompt);
    }

    if (draft.focus) {
      textareaRef.current?.focus();
    }
  }, [draft]);

  function createSelectedImage(file: File): SelectedImage {
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);

    return {
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl
    };
  }

  function revokeSelectedImage(image: SelectedImage) {
    URL.revokeObjectURL(image.previewUrl);
    previewUrlsRef.current.delete(image.previewUrl);
  }

  function syncFileInput(files: File[]) {
    if (!fileInputRef.current) {
      return;
    }

    if (files.length === 0) {
      fileInputRef.current.value = "";
      return;
    }

    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }
    fileInputRef.current.files = dataTransfer.files;
  }

  function setSelectedReferenceImages(files: File[]) {
    setSelectedImages((current) => {
      for (const image of current) {
        revokeSelectedImage(image);
      }

      return files.map(createSelectedImage);
    });
    syncFileInput(files);
  }

  function appendSelectedReferenceImages(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setSelectedImages((current) => [
      ...current,
      ...files.map(createSelectedImage)
    ]);
  }

  function clearSelectedImages() {
    setSelectedReferenceImages([]);
  }

  function removeSelectedImage(id: string) {
    setSelectedImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) {
        revokeSelectedImage(image);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    const imageFiles = selectedImages.map((image) => image.file);

    if (!trimmedPrompt) {
      setError("请输入图片描述。");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setPrompt("");
      clearSelectedImages();
      formRef.current?.reset();
      await onSubmitted({ prompt: trimmedPrompt, imageFiles, size, quality, count });
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
    const imageItems = Array.from(event.clipboardData.items).filter((item) =>
      item.type.startsWith("image/")
    );

    if (imageItems.length === 0) {
      return;
    }

    const pastedImages = imageItems
      .map((imageItem) => imageItem.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (pastedImages.length === 0) {
      return;
    }

    event.preventDefault();

    const normalizedImages = pastedImages.map((pastedImage, index) => {
      const fileName =
        pastedImage.name && pastedImage.name.trim()
          ? pastedImage.name
          : `pasted-image-${index + 1}.${pastedImage.type.split("/")[1] || "png"}`;

      return new File([pastedImage], fileName, {
        type: pastedImage.type
      });
    });

    appendSelectedReferenceImages(normalizedImages);
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
          <span>画面描述</span>
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
          placeholder="描述主体、场景、风格和用途。按 Enter 生成，Ctrl + Enter 换行，也支持直接粘贴参考图。"
          rows={7}
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

      {selectedImages.length > 0 ? (
        <div className="composer-preview-grid">
          {selectedImages.map((image, index) => (
            <div className="composer-preview-card" key={image.id}>
              <img
                src={image.previewUrl}
                alt={image.file.name || `参考图预览 ${index + 1}`}
                className="composer-preview-image"
              />
              <div className="composer-preview-meta">
                <span className="composer-preview-name">
                  {image.file.name || `参考图 ${index + 1}`}
                </span>
                <button
                  type="button"
                  className="composer-preview-remove"
                  onClick={() => removeSelectedImage(image.id)}
                  disabled={disabled || submitting || optimizing}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="composer-actions-row">
        <label className="file-picker">
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => {
              appendSelectedReferenceImages(
                Array.from(event.currentTarget.files ?? [])
              );
              event.currentTarget.value = "";
            }}
            disabled={disabled || submitting || optimizing}
          />
          <span>{selectedImages.length > 0 ? "继续上传参考图" : "上传参考图"}</span>
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
          {selectedImages.length > 0
            ? `已选择 ${selectedImages.length} 张参考图`
            : "未选择文件"}
        </span>
        <button type="submit" disabled={disabled || submitting || optimizing}>
          {submitting ? "生成中..." : "生成图片"}
        </button>
      </div>

      {error ? <p className="composer-error">{error}</p> : null}
    </form>
  );
}
