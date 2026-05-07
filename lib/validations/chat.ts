import { z } from "zod";

const optionalText = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return value;
  }, schema.optional());

export const imageParamsSchema = z.object({
  size: optionalText(z.enum(["auto", "1024x1024", "1536x1024", "1024x1536"])),
  quality: optionalText(z.enum(["auto", "low", "medium", "high"])),
  count: z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return value;
  }, z.coerce.number().int().min(1).max(4).optional())
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(4000).optional(),
  initialContent: z.string().trim().min(1).max(4000).optional()
});

export const imageRequestBaseSchema = z.object({
  sessionId: z.string().trim().min(1),
  prompt: z.string().trim().min(1).max(4000)
});

export const generateImageSchema = imageRequestBaseSchema.merge(imageParamsSchema);

export const editImageSchema = imageRequestBaseSchema.merge(imageParamsSchema);

export function deriveSessionTitle(content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    return "新的图片会话";
  }

  return trimmed.slice(0, 30);
}
