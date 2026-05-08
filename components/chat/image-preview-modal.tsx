"use client";

import {
  MouseEvent,
  WheelEvent,
  useEffect,
  useRef,
  useState
} from "react";
import {
  DEFAULT_PREVIEW_SCALE,
  clampPreviewOffset,
  clampPreviewScale,
  getFitPreviewScale,
  getMaxPreviewScale,
  getNextDoubleClickScale,
  getWheelZoomState,
  getZoomStateAtPoint
} from "@/lib/image-preview-zoom";

type ImagePreviewModalProps = {
  filePath: string;
  alt: string;
  onClose: () => void;
};

type Offset = {
  x: number;
  y: number;
};

type DragState = Offset & {
  startX: number;
  startY: number;
};

export function ImagePreviewModal({
  filePath,
  alt,
  onClose
}: ImagePreviewModalProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [scale, setScale] = useState(DEFAULT_PREVIEW_SCALE);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [baseSize, setBaseSize] = useState({ width: 0, height: 0 });
  const [fitScale, setFitScale] = useState(DEFAULT_PREVIEW_SCALE);
  const [copyMessage, setCopyMessage] = useState("");
  const maxScale = getMaxPreviewScale(fitScale);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;

      if (!rect) {
        return;
      }

      setStageSize({
        width: rect.width,
        height: rect.height
      });
    });
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleWindowMouseMove(event: globalThis.MouseEvent) {
      const drag = dragRef.current;

      if (!drag) {
        return;
      }

      event.preventDefault();
      setOffset({
        x: drag.x + event.clientX - drag.startX,
        y: drag.y + event.clientY - drag.startY
      });
    }

    function handleWindowMouseUp() {
      dragRef.current = null;
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, []);

  function syncImageFit(nextScale = scale) {
    const image = imageRef.current;

    if (!image || stageSize.width <= 0 || stageSize.height <= 0) {
      return;
    }

    const nextFitScale = getFitPreviewScale({
      image: {
        width: image.naturalWidth,
        height: image.naturalHeight
      },
      stage: stageSize
    });
    const nextBaseSize = {
      width: image.naturalWidth * nextFitScale,
      height: image.naturalHeight * nextFitScale
    };

    setFitScale(nextFitScale);
    setBaseSize(nextBaseSize);
    setOffset((current) =>
      nextScale === DEFAULT_PREVIEW_SCALE
        ? current
        : clampPreviewOffset({
            offset: current,
            scale: nextScale,
            baseSize: nextBaseSize,
            stageSize
          })
    );
  }

  useEffect(() => {
    syncImageFit();
  }, [filePath, stageSize]);

  function clampOffset(nextOffset: Offset, nextScale = scale) {
    return clampPreviewOffset({
      offset: nextOffset,
      scale: nextScale,
      baseSize,
      stageSize
    });
  }

  function resetView() {
    setScale(DEFAULT_PREVIEW_SCALE);
    setOffset({ x: 0, y: 0 });
  }

  function applyZoom(nextScale: number, pointer: Offset = { x: 0, y: 0 }) {
    const next = getZoomStateAtPoint({
      scale,
      nextScale,
      offset,
      pointer,
      maxScale
    });

    setScale(next.scale);
    setOffset(
      next.scale === DEFAULT_PREVIEW_SCALE
        ? next.offset
        : clampOffset(next.offset, next.scale)
    );
  }

  function zoomBy(delta: number) {
    const nextScale =
      delta > 0
        ? Math.round(scale * 1.25 * 100) / 100
        : Math.round((scale / 1.25) * 100) / 100;
    applyZoom(clampPreviewScale(nextScale, maxScale));
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const next = getWheelZoomState({
      scale,
      offset,
      pointer: {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2
      },
      deltaY: event.deltaY,
      maxScale
    });

    setScale(next.scale);
    setOffset(
      next.scale === DEFAULT_PREVIEW_SCALE
        ? next.offset
        : clampOffset(next.offset, next.scale)
    );
  }

  function preventPageWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleStageDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    applyZoom(getNextDoubleClickScale(scale), {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2
    });
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: offset.x,
      y: offset.y
    };
  }

  async function handleCopyImage() {
    try {
      setCopyMessage("");
      const response = await fetch(filePath);

      if (!response.ok) {
        throw new Error("无法读取图片");
      }

      const blob = await response.blob();

      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("当前浏览器不支持复制图片");
      }

      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("无法复制图片");
      }

      context.drawImage(imageBitmap, 0, 0);
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!pngBlob) {
        throw new Error("无法复制图片");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob
        })
      ]);
      setCopyMessage("已复制");
      window.setTimeout(() => setCopyMessage(""), 1500);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : "复制失败");
    }
  }

  return (
    <div
      className="image-preview-backdrop"
      onClick={onClose}
      onWheel={preventPageWheel}
    >
      <div
        className="image-preview-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="image-preview-actions">
          <span className="image-preview-zoom-label">
            适屏 {Math.round(scale * 100)}%
            {fitScale < 1 ? ` / 原图 ${Math.round(scale * fitScale * 100)}%` : ""}
          </span>
          <button type="button" title="缩小" onClick={() => zoomBy(-1)}>
            -
          </button>
          <button type="button" title="放大" onClick={() => zoomBy(1)}>
            +
          </button>
          <button type="button" onClick={resetView}>
            适屏
          </button>
          <button type="button" onClick={() => void handleCopyImage()}>
            {copyMessage || "复制"}
          </button>
          <a href={filePath} download>
            下载
          </a>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div
          ref={stageRef}
          className="image-preview-stage"
          onWheel={handleWheel}
          onDoubleClick={handleStageDoubleClick}
          onMouseDown={handleMouseDown}
        >
          <img
            ref={imageRef}
            src={filePath}
            alt={alt}
            draggable={false}
            onLoad={() => {
              resetView();
              syncImageFit(DEFAULT_PREVIEW_SCALE);
            }}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
            }}
          />
        </div>
      </div>
    </div>
  );
}
