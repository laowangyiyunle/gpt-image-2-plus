import { z } from "zod";

export const optimizePromptSchema = z.object({
  prompt: z.string().trim().min(1).max(4000)
});
