import { NextRequest, NextResponse } from "next/server";
import { listDeletedMessages } from "@/lib/services/session-service";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const messages = await listDeletedMessages(id);

  return NextResponse.json({ messages });
}
