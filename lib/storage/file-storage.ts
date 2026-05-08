import fs from "node:fs/promises";
import path from "node:path";
import { buildStoredFileName, safeJoin } from "../security/path-safety.ts";

const publicDir = path.join(process.cwd(), "public");
const uploadDir = path.join(publicDir, "uploads");
const generatedDir = path.join(publicDir, "generated");

export async function ensureStorageDirs() {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });
}

export async function saveBufferAsFile(
  buffer: Buffer,
  kind: "upload" | "generated",
  extension: string
) {
  await ensureStorageDirs();

  const fileName = buildStoredFileName(kind, extension);
  const baseDir = kind === "upload" ? uploadDir : generatedDir;
  const absolutePath = safeJoin(baseDir, fileName);

  await fs.writeFile(absolutePath, buffer);

  return {
    absolutePath,
    publicPath: `/${kind === "upload" ? "uploads" : "generated"}/${fileName}`
  };
}

export async function removeStoredFile(publicPath: string) {
  const relativePath = publicPath.replace(/^\//, "");
  const absolutePath = safeJoin(publicDir, relativePath);

  await fs.rm(absolutePath, { force: true });
}

export function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  return "bin";
}
