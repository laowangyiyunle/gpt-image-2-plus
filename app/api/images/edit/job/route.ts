import { NextRequest, NextResponse } from "next/server";
import {
  ensureStorageDirs,
  extensionFromMimeType,
  removeStoredFile,
  saveBufferAsFile
} from "@/lib/storage/file-storage";
import { startEditImageJob } from "@/lib/services/image-job-service";
import { getSessionById } from "@/lib/services/session-service";
import { editImageSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  await ensureStorageDirs();

  const formData = await request.formData();
  const imageFile = formData.get("image");
  const parsed = editImageSchema.safeParse({
    sessionId: formData.get("sessionId"),
    prompt: formData.get("prompt"),
    size: formData.get("size"),
    quality: formData.get("quality"),
    count: formData.get("count")
  });

  if (!parsed.success || !(imageFile instanceof File)) {
    return NextResponse.json({ error: "请求参数不完整" }, { status: 400 });
  }

  if (!imageFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "只支持图片文件" }, { status: 400 });
  }

  if (imageFile.size <= 0 || imageFile.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "图片大小不合法" }, { status: 400 });
  }

  const { sessionId, prompt, size, quality, count } = parsed.data;
  const session = await getSessionById(sessionId);

  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
  const upload = await saveBufferAsFile(
    inputBuffer,
    "upload",
    extensionFromMimeType(imageFile.type)
  );
  let job;

  try {
    job = await startEditImageJob({
      sessionId,
      prompt,
      size,
      quality,
      count,
      imageBuffer: inputBuffer,
      imageMimeType: imageFile.type,
      uploadedImage: {
        filePath: upload.publicPath,
        mimeType: imageFile.type,
        sourceType: "uploaded"
      }
    });
  } catch (error) {
    await removeStoredFile(upload.publicPath).catch(() => undefined);
    throw error;
  }

  return NextResponse.json(
    {
      userMessage: job.userMessage,
      message: job.assistantMessage
    },
    { status: 202 }
  );
}
