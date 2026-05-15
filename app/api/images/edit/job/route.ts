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
import {
  getReferenceImageFiles,
  validateReferenceImageFiles
} from "@/lib/reference-image-files";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  await ensureStorageDirs();

  const formData = await request.formData();
  const imageFiles = getReferenceImageFiles(formData);
  const parsed = editImageSchema.safeParse({
    sessionId: formData.get("sessionId"),
    prompt: formData.get("prompt"),
    size: formData.get("size"),
    quality: formData.get("quality"),
    count: formData.get("count")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "请求参数不完整" }, { status: 400 });
  }

  const imageValidationError = validateReferenceImageFiles(
    imageFiles,
    MAX_UPLOAD_SIZE
  );
  if (imageValidationError) {
    return NextResponse.json({ error: imageValidationError }, { status: 400 });
  }

  const { sessionId, prompt, size, quality, count } = parsed.data;
  const session = await getSessionById(sessionId);

  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  const imageInputs = await Promise.all(
    imageFiles.map(async (imageFile) => ({
      buffer: Buffer.from(await imageFile.arrayBuffer()),
      mimeType: imageFile.type
    }))
  );
  const uploads = await Promise.all(
    imageInputs.map((imageInput) =>
      saveBufferAsFile(
        imageInput.buffer,
        "upload",
        extensionFromMimeType(imageInput.mimeType)
      )
    )
  );
  let job;

  try {
    job = await startEditImageJob({
      sessionId,
      prompt,
      size,
      quality,
      count,
      imageInputs,
      uploadedImages: uploads.map((upload, index) => ({
        filePath: upload.publicPath,
        mimeType: imageInputs[index].mimeType,
        sourceType: "uploaded"
      }))
    });
  } catch (error) {
    await Promise.all(
      uploads.map((upload) =>
        removeStoredFile(upload.publicPath).catch(() => undefined)
      )
    );
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
