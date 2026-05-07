import { NextRequest } from "next/server";
import { createRuntimeFileResponse } from "@/lib/storage/runtime-file-route";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  return createRuntimeFileResponse("generated", filename);
}
