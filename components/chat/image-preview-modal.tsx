"use client";

import {
  MouseEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useRef,
  useState
} from "react";
import {
  DEFAULT_PREVIEW_SCALE,
  clampPreviewScale,
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
  pointerId: number;
  startX: number;
  startY: number;
};

export function ImagePreviewModal({
  filePath,
  alt,
  onClose
}: ImagePreviewModalProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [scale, setScale] = useState(DEFAULT_PREVIEW_SCALE);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

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

  function resetView() {
    setScale(DEFAULT_PREVIEW_SCALE);
    setOffset({ x: 0, y: 0 });
  }

  function applyZoom(nextScale: number, pointer: Offset = { x: 0, y: 0 }) {
    const next = getZoomStateAtPoint({
      scale,
      nextScale,
      offset,
      pointer
    });

    setScale(next.scale);
    setOffset(next.scale === DEFAULT_PREVIEW_SCALE ? { x: 0, y: 0 } : next.offset);
  }

  function zoomBy(delta: number) {
    applyZoom(clampPreviewScale(Math.round((scale + delta) * 100) / 100));
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
      deltaY: event.deltaY
    });

    setScale(next.scale);
    setOffset(next.scale === DEFAULT_PREVIEW_SCALE ? { x: 0, y: 0 } : next.offset);
  }

  function preventPageWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleImageDoubleClick(event: MouseEvent<HTMLImageElement>) {
    const stage = event.currentTarget.parentElement;

    if (!stage) {
      applyZoom(getNextDoubleClickScale(scale));
      return;
    }

    const rect = stage.getBoundingClientRect();
    applyZoom(getNextDoubleClickScale(scale), {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLImageElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: offset.x,
      y: offset.y
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLImageElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextOffset = {
      x: drag.x + event.clientX - drag.startX,
      y: drag.y + event.clientY - drag.startY
    };
    setOffset(nextOffset);
  }

  function handlePointerUp(event: PointerEvent<HTMLImageElement>) {
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null;
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
            {Math.round(scale * 100)}%
          </span>
          <button type="button" title="缩小" onClick={() => zoomBy(-0.25)}>
            -
          </button>
          <button type="button" title="放大" onClick={() => zoomBy(0.25)}>
            +
          </button>
          <button type="button" onClick={resetView}>
            适屏
          </button>
          <a href={filePath} download>
            下载
          </a>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="image-preview-stage" onWheel={handleWheel}>
          <img
            ref={imageRef}
            src={filePath}
            alt={alt}
            draggable={false}
            onDoubleClick={handleImageDoubleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
            }}
          />
        </div>
      </div>
    </div>
  );
}
