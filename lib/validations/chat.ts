import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(60).optional()
});

export const generateImageSchema = z.object({
  sessionId: z.string().trim().min(1),
  prompt: z.string().trim().min(1).max(4000),
  size: z.string().trim().min(1).max(40).optional(),
  quality: z.string().trim().min(1).max(40).optional(),
  count: z.number().int().min(1).max(4).optional()
});

export function deriveSessionTitle(content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    return "新的图片会话";
  }

  return trimmed.slice(0, 30);
}
