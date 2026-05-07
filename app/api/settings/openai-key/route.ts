import { NextRequest, NextResponse } from "next/server";
import {
  getOpenAIKeyStatus,
  upsertOpenAIBaseUrl,
  upsertOpenAIKey
} from "@/lib/services/runtime-config-service";
import { saveOpenAIKeySchema } from "@/lib/validations/settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getOpenAIKeyStatus());
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = saveOpenAIKeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "配置格式不合法" }, { status: 400 });
  }

  const saved = parsed.data.apiKey ? upsertOpenAIKey(parsed.data.apiKey) : null;
  const baseUrl = parsed.data.baseUrl?.trim();

  if (baseUrl) {
    upsertOpenAIBaseUrl(baseUrl);
  }

  const status = getOpenAIKeyStatus();

  return NextResponse.json({
    configured: status.configured,
    maskedKey: saved?.maskedKey ?? status.maskedKey,
    baseUrl: baseUrl ?? status.baseUrl,
    source: "database"
  });
}
