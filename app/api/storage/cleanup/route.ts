import { NextRequest, NextResponse } from "next/server";
import {
  cleanupOrphanFiles,
  clearAllHistoryAndFiles,
  getStorageCleanupStats
} from "@/lib/services/storage-cleanup-service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getStorageCleanupStats());
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    mode?: string;
  };

  if (body.mode === "all") {
    return NextResponse.json(await clearAllHistoryAndFiles());
  }

  return NextResponse.json(await cleanupOrphanFiles());
}
