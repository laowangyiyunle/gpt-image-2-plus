import { getOpenAIClient } from "@/lib/openai/client";
import { PROMPT_OPTIMIZER_MODEL } from "@/lib/openai/prompt-model";

const PROMPT_OPTIMIZER_INSTRUCTIONS = [
  "你是一个专业中文图像生成提示词优化器。",
  "把用户输入改写成更适合图片生成模型的中文提示词。",
  "保留用户原始意图，不新增具体品牌、人物姓名、版权角色或敏感信息。",
  "输出只包含优化后的提示词，不要解释，不要使用 Markdown。",
  "结构建议包含主体与内容、构图与镜头、光影与质感、风格与氛围、质量要求。",
  "如果用户已经提供了结构化提示词，只做精炼和补全，不重复套模板。"
].join("\n");

export async function optimizePromptWithModel(prompt: string) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: PROMPT_OPTIMIZER_MODEL,
    instructions: PROMPT_OPTIMIZER_INSTRUCTIONS,
    input: prompt,
    max_output_tokens: 900
  });
  const optimizedPrompt = response.output_text?.trim();

  if (!optimizedPrompt) {
    throw new Error("Prompt optimization returned no text");
  }

  return optimizedPrompt;
}
