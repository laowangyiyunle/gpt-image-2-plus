import { NextResponse } from "next/server";
import { listImageTemplates } from "@/lib/services/session-service";

export const runtime = "nodejs";

export async function GET() {
  const templates = await listImageTemplates();
  return NextResponse.json({ templates });
}
