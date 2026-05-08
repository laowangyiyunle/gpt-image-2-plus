const structuredPromptMarkers = [
  "主体与内容",
  "构图与镜头",
  "光影与质感",
  "风格与氛围",
  "质量要求"
];

export function optimizeImagePrompt(prompt: string) {
  const trimmed = prompt.trim();

  if (!trimmed) {
    return "";
  }

  if (structuredPromptMarkers.some((marker) => trimmed.includes(marker))) {
    return trimmed;
  }

  return [
    `主体与内容：${trimmed}`,
    "构图与镜头：主体清晰，构图稳定，层次分明，画面重点明确。",
    "光影与质感：自然光影，材质细节真实，色彩协调，整体观感干净。",
    "风格与氛围：根据主体选择合适风格，避免过度装饰，保持画面高级且易读。",
    "质量要求：高清细节，边缘干净，避免低清晰度、畸变、杂乱背景和多余文字。"
  ].join("\n");
}
