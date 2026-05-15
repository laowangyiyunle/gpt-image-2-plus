import { NextRequest, NextResponse } from "next/server";
import {
  ensureStorageDirs,
  extensionFromMimeType,
  removeStoredFile,
  saveBufferAsFile
} from "@/lib/storage/file-storage";
import {
  generateImageFromEdit,
  saveGeneratedBase64Image,
  streamImagesFromEdit
} from "@/lib/services/image-service";
import { isStreamingUnsupportedError } from "@/lib/openai/streaming-support";
import {
  createAssistantMessageWithImages,
  createUserMessage,
  getSessionById
} from "@/lib/services/session-service";
import { createSseResponse } from "@/lib/streaming/sse";
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

  await createUserMessage(sessionId, prompt);

  return createSseResponse(async (writer) => {
    const completedImages: string[] = [];

    try {
      const stream = await streamImagesFromEdit({
        prompt,
        imageBuffer: inputBuffer,
        imageMimeType: imageFile.type,
        size,
        quality,
        count
      });

      for await (const event of stream) {
        if (event.type === "image_edit.partial_image") {
          writer.send("partial", {
            partialImageIndex: event.partial_image_index,
            imageDataUrl: `data:image/${event.output_format};base64,${event.b64_json}`
          });
          continue;
        }

        if (event.type === "image_edit.completed") {
          completedImages.push(event.b64_json);
          writer.send("finalizing", {});
        }
      }

      if (completedImages.length === 0) {
        throw new Error("Image edit stream returned no final image data");
      }

      const savedImages = await Promise.all(
        completedImages.map((base64) => saveGeneratedBase64Image(base64))
      );
      const message = await createAssistantMessageWithImages({
        sessionId,
        content: "已根据参考图生成新图片。",
        status: "success",
        images: [
          {
            filePath: upload.publicPath,
            mimeType: imageFile.type,
            sourceType: "uploaded"
          },
          ...savedImages.map((image) => ({
            filePath: image.publicPath,
            mimeType: "image/png",
            sourceType: "generated"
          }))
        ]
      });

      writer.send("complete", { message });
    } catch (error) {
      if (
        completedImages.length === 0 &&
        isStreamingUnsupportedError(error)
      ) {
        writer.send("finalizing", {});

        const images = await generateImageFromEdit({
          prompt,
          imageInputs: [
            {
              buffer: inputBuffer,
              mimeType: imageFile.type
            }
          ],
          size,
          quality,
          count
        });
        const message = await createAssistantMessageWithImages({
          sessionId,
          content: "已根据参考图生成新图片。",
          status: "success",
          images: [
            {
              filePath: upload.publicPath,
              mimeType: imageFile.type,
              sourceType: "uploaded"
            },
            ...images.map((image) => ({
              filePath: image.publicPath,
              mimeType: "image/png",
              sourceType: "generated"
            }))
          ]
        });

        writer.send("complete", { message });
        return;
      }

      await removeStoredFile(upload.publicPath).catch(() => undefined);

      const message = await createAssistantMessageWithImages({
        sessionId,
        content: "图片编辑失败，请检查 Key 配置、额度或稍后重试。",
        status: "failed"
      });

      writer.send("error", {
        error:
          error instanceof Error && error.message === "Missing OPENAI_API_KEY"
            ? "缺少 OPENAI_API_KEY 配置"
            : "图片编辑失败，请稍后重试",
        message
      });
    }
  });
}
