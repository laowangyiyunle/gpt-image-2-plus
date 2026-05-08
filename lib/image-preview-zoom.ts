export const MIN_PREVIEW_SCALE = 0.5;
export const MAX_PREVIEW_SCALE = 5;
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

export function clampPreviewScale(scale: number) {
  if (!Number.isFinite(scale)) {
    return DEFAULT_PREVIEW_SCALE;
  }

  return Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, scale));
}

export function getNextDoubleClickScale(currentScale: number) {
  return currentScale > DEFAULT_PREVIEW_SCALE
    ? DEFAULT_PREVIEW_SCALE
    : DOUBLE_CLICK_PREVIEW_SCALE;
}

export function getWheelScale(currentScale: number, deltaY: number) {
  const step = deltaY < 0 ? 0.15 : -0.15;
  const nextScale = Math.round((currentScale + step) * 100) / 100;

  return clampPreviewScale(nextScale);
}

export function getZoomStateAtPoint(args: {
  scale: number;
  nextScale: number;
  offset: PreviewPoint;
  pointer: PreviewPoint;
}) {
  const nextScale = clampPreviewScale(args.nextScale);
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
}) {
  return getZoomStateAtPoint({
    scale: args.scale,
    nextScale: getWheelScale(args.scale, args.deltaY),
    offset: args.offset,
    pointer: args.pointer
  });
}
