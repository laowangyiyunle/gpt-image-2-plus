import { NextRequest, NextResponse } from "next/server";
import { hardDeleteMessageById } from "@/lib/services/session-service";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = await hardDeleteMessageById(id);

  if (!result) {
    return NextResponse.json(
      { error: "消息不存在或未在回收站" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    sessionId: result.sessionId
  });
}
