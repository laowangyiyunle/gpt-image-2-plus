import { NextRequest, NextResponse } from "next/server";
import { startGenerateImageJob } from "@/lib/services/image-job-service";
import { getSessionById } from "@/lib/services/session-service";
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

  const { userMessage, assistantMessage } = await startGenerateImageJob({
    sessionId,
    prompt,
    size,
    quality,
    count
  });

  return NextResponse.json(
    {
      userMessage,
      message: assistantMessage
    },
    { status: 202 }
  );
}
