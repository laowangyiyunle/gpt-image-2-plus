import { z } from "zod";

const baseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "Base URL 必须以 http:// 或 https:// 开头"
  )
  .transform((value) => value.replace(/\/+$/, ""));

export const saveOpenAIKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(400).optional(),
  baseUrl: baseUrlSchema.optional()
}).refine((value) => Boolean(value.apiKey || value.baseUrl), {
  message: "API Key 或 Base URL 至少填写一项"
});

export const testOpenAIKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(400).optional(),
  baseUrl: baseUrlSchema.optional()
});
