export type GenerationProgress = {
  percent: number;
  label: string;
  elapsedSeconds: number;
};

type GenerationProgressInput = {
  elapsedSeconds: number;
  hasReferenceImage: boolean;
};

export function getInitialGenerationProgress({
  elapsedSeconds,
  hasReferenceImage
}: GenerationProgressInput): GenerationProgress {
  const safeElapsedSeconds = Math.max(0, Math.floor(elapsedSeconds));

  return {
    percent: 10,
    label: hasReferenceImage ? "等待生成预览" : "等待首张预览图",
    elapsedSeconds: safeElapsedSeconds
  };
}

export function getPartialImageProgress({
  partialImageIndex,
  elapsedSeconds
}: {
  partialImageIndex: number;
  elapsedSeconds: number;
}): GenerationProgress {
  const safeIndex = Math.max(0, Math.min(2, Math.floor(partialImageIndex)));
  const percents = [45, 70, 85];

  return {
    percent: percents[safeIndex],
    label: `已收到第 ${safeIndex + 1} 张预览图`,
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds))
  };
}

export function getFinalizingGenerationProgress({
  elapsedSeconds
}: {
  elapsedSeconds: number;
}): GenerationProgress {
  return {
    percent: 95,
    label: "正在保存最终图片",
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds))
  };
}

export function withElapsedSeconds(
  progress: GenerationProgress,
  elapsedSeconds: number
): GenerationProgress {
  return {
    ...progress,
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds))
  };
}
