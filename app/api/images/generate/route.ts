import { NextRequest, NextResponse } from "next/server";
import { generateImageFromPrompt } from "@/lib/services/image-service";
import {
  createAssistantMessageWithImages,
  createUserMessage,
  getSessionById
} from "@/lib/services/session-service";
import { generateImageSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = generateImageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
  }

  const { sessionId, prompt, size, quality, count } = parsed.data;
  const session = await getSessionById(sessionId);

  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  await createUserMessage(sessionId, prompt);

  try {
    const images = await generateImageFromPrompt({ prompt, size, quality, count });
    const message = await createAssistantMessageWithImages({
      sessionId,
      content: "已为你生成图片。",
      status: "success",
      images: images.map((image) => ({
          filePath: image.publicPath,
          mimeType: "image/png",
          sourceType: "generated"
      }))
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    const message = await createAssistantMessageWithImages({
      sessionId,
      content: "生成失败，请检查 Key 配置、额度或稍后重试。",
      status: "failed"
    });

    const errorMessage =
      error instanceof Error && error.message === "Missing OPENAI_API_KEY"
        ? "缺少 OPENAI_API_KEY 配置"
        : "生成失败，请稍后重试";

    return NextResponse.json({ error: errorMessage, message }, { status: 500 });
  }
}
