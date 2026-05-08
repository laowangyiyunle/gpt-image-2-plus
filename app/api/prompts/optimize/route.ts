import { NextRequest, NextResponse } from "next/server";
import { optimizePromptWithModel } from "@/lib/services/prompt-optimizer-service";
import { optimizePromptSchema } from "@/lib/validations/prompt";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = optimizePromptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "提示词不能为空或过长" }, { status: 400 });
  }

  try {
    const prompt = await optimizePromptWithModel(parsed.data.prompt);
    return NextResponse.json({ prompt });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Missing OPENAI_API_KEY"
        ? "缺少 OpenAI API Key 配置"
        : "优化失败，请检查 Key、模型权限或稍后重试";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
