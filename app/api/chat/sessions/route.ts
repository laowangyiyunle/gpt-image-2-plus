import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessions } from "@/lib/services/session-service";
import { createSessionSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "会话参数不合法" }, { status: 400 });
  }

  const session = await createSession(parsed.data.title);
  return NextResponse.json({ session }, { status: 201 });
}
