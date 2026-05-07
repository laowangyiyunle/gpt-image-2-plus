import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { safeJoin } from "@/lib/security/path-safety";

const publicDir = path.join(process.cwd(), "public");

function getMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function createRuntimeFileResponse(
  kind: "generated" | "uploads",
  fileName: string
) {
  const baseDir = safeJoin(publicDir, kind);
  const absolutePath = safeJoin(baseDir, fileName);

  try {
    const fileBuffer = await fs.readFile(absolutePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": getMimeType(fileName),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    return NextResponse.json({ error: "文件读取失败" }, { status: 500 });
  }
}
