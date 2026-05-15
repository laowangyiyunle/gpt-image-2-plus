export const MIN_PREVIEW_SCALE = 0.5;
export const MAX_PREVIEW_SCALE = 5;
export const MAX_NATURAL_PREVIEW_SCALE = 3;
export const DEFAULT_PREVIEW_SCALE = 1;
export const DOUBLE_CLICK_PREVIEW_SCALE = 2;

export type PreviewPoint = {
  x: number;
  y: number;
};

export type PreviewZoomState = {
  scale: number;
  offset: PreviewPoint;
};

export type PreviewSize = {
  width: number;
  height: number;
};

export function getFitPreviewScale(args: {
  image: PreviewSize;
  stage: PreviewSize;
}) {
  if (
    args.image.width <= 0 ||
    args.image.height <= 0 ||
    args.stage.width <= 0 ||
    args.stage.height <= 0
  ) {
    return DEFAULT_PREVIEW_SCALE;
  }

  return Math.min(
    DEFAULT_PREVIEW_SCALE,
    args.stage.width / args.image.width,
    args.stage.height / args.image.height
  );
}

export function getMaxPreviewScale(fitScale: number) {
  if (!Number.isFinite(fitScale) || fitScale <= 0) {
    return MAX_PREVIEW_SCALE;
  }

  return Math.max(MAX_PREVIEW_SCALE, MAX_NATURAL_PREVIEW_SCALE / fitScale);
}

export function clampPreviewScale(scale: number, maxScale = MAX_PREVIEW_SCALE) {
  if (!Number.isFinite(scale)) {
    return DEFAULT_PREVIEW_SCALE;
  }

  return Math.min(maxScale, Math.max(MIN_PREVIEW_SCALE, scale));
}

export function getNextDoubleClickScale(currentScale: number) {
  return currentScale > DEFAULT_PREVIEW_SCALE
    ? DEFAULT_PREVIEW_SCALE
    : DOUBLE_CLICK_PREVIEW_SCALE;
}

export function getNextPreviewImageIndex(
  currentIndex: number,
  imageCount: number,
  direction: -1 | 1
) {
  if (imageCount <= 1) {
    return 0;
  }

  return (currentIndex + direction + imageCount) % imageCount;
}

export function getWheelScale(currentScale: number, deltaY: number) {
  const multiplier = deltaY < 0 ? 1.18 : 1 / 1.18;
  const nextScale = Math.round(currentScale * multiplier * 100) / 100;

  return nextScale;
}

export function getZoomStateAtPoint(args: {
  scale: number;
  nextScale: number;
  offset: PreviewPoint;
  pointer: PreviewPoint;
  maxScale?: number;
}) {
  const nextScale = clampPreviewScale(args.nextScale, args.maxScale);
  const ratio = nextScale / args.scale;

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      scale: DEFAULT_PREVIEW_SCALE,
      offset: { x: 0, y: 0 }
    };
  }

  const x = Math.round((args.pointer.x - (args.pointer.x - args.offset.x) * ratio) * 100) / 100;
  const y = Math.round((args.pointer.y - (args.pointer.y - args.offset.y) * ratio) * 100) / 100;

  return {
    scale: nextScale,
    offset: {
      x: Object.is(x, -0) ? 0 : x,
      y: Object.is(y, -0) ? 0 : y
    }
  };
}

export function getWheelZoomState(args: {
  scale: number;
  offset: PreviewPoint;
  pointer: PreviewPoint;
  deltaY: number;
  maxScale?: number;
}) {
  return getZoomStateAtPoint({
    scale: args.scale,
    nextScale: getWheelScale(args.scale, args.deltaY),
    offset: args.offset,
    pointer: args.pointer,
    maxScale: args.maxScale
  });
}

export function clampPreviewOffset(args: {
  offset: PreviewPoint;
  scale: number;
  baseSize: PreviewSize;
  stageSize: PreviewSize;
}) {
  const scaledWidth = args.baseSize.width * args.scale;
  const scaledHeight = args.baseSize.height * args.scale;
  const maxX = Math.max(0, (scaledWidth - args.stageSize.width) / 2);
  const maxY = Math.max(0, (scaledHeight - args.stageSize.height) / 2);

  return {
    x: Math.min(maxX, Math.max(-maxX, args.offset.x)),
    y: Math.min(maxY, Math.max(-maxY, args.offset.y))
  };
}
