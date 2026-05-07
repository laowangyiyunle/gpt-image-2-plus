import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  getStoredOpenAIBaseUrl,
  getStoredOpenAIKey
} from "@/lib/services/runtime-config-service";
import { testOpenAIKeySchema } from "@/lib/validations/settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = testOpenAIKeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "API Key 格式不合法" },
      { status: 400 }
    );
  }

  const candidate =
    parsed.data.apiKey?.trim() ||
    getStoredOpenAIKey()?.value ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  const baseURL =
    parsed.data.baseUrl?.trim() ||
    getStoredOpenAIBaseUrl()?.value ||
    process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "") ||
    undefined;

  if (!candidate) {
    return NextResponse.json(
      { ok: false, message: "当前没有可测试的 API Key" },
      { status: 400 }
    );
  }

  try {
    const client = new OpenAI({
      apiKey: candidate,
      ...(baseURL ? { baseURL } : {})
    });
    await client.models.list();
    return NextResponse.json({ ok: true, message: "连接成功" });
  } catch {
    return NextResponse.json(
      { ok: false, message: "连接失败，请检查 Key 或 Base URL" },
      { status: 400 }
    );
  }
}
