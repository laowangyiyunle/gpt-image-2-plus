import { NextRequest, NextResponse } from "next/server";
import {
  generateImageFromPrompt,
  saveGeneratedBase64Image,
  streamImagesFromPrompt
} from "@/lib/services/image-service";
import { isStreamingUnsupportedError } from "@/lib/openai/streaming-support";
import {
  createAssistantMessageWithImages,
  createUserMessage,
  getSessionById
} from "@/lib/services/session-service";
import { createSseResponse } from "@/lib/streaming/sse";
import { generateImageSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = generateImageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
  }

  const { sessionId, prompt, size, quality, count } = parsed.data;
  const session = await getSessionById(sessionId);

  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  await createUserMessage(sessionId, prompt);

  return createSseResponse(async (writer) => {
    const completedImages: string[] = [];

    try {
      const stream = await streamImagesFromPrompt({ prompt, size, quality, count });

      for await (const event of stream) {
        if (event.type === "image_generation.partial_image") {
          writer.send("partial", {
            partialImageIndex: event.partial_image_index,
            imageDataUrl: `data:image/${event.output_format};base64,${event.b64_json}`
          });
          continue;
        }

        if (event.type === "image_generation.completed") {
          completedImages.push(event.b64_json);
          writer.send("finalizing", {});
        }
      }

      if (completedImages.length === 0) {
        throw new Error("Image stream returned no final image data");
      }

      const savedImages = await Promise.all(
        completedImages.map((base64) => saveGeneratedBase64Image(base64))
      );
      const message = await createAssistantMessageWithImages({
        sessionId,
        content: "已为你生成图片。",
        status: "success",
        images: savedImages.map((image) => ({
          filePath: image.publicPath,
          mimeType: "image/png",
          sourceType: "generated"
        }))
      });

      writer.send("complete", { message });
    } catch (error) {
      if (
        completedImages.length === 0 &&
        isStreamingUnsupportedError(error)
      ) {
        writer.send("finalizing", {});

        const images = await generateImageFromPrompt({
          prompt,
          size,
          quality,
          count
        });
        const message = await createAssistantMessageWithImages({
          sessionId,
          content: "已为你生成图片。",
          status: "success",
          images: images.map((image) => ({
            filePath: image.publicPath,
            mimeType: "image/png",
            sourceType: "generated"
          }))
        });

        writer.send("complete", { message });
        return;
      }

      const message = await createAssistantMessageWithImages({
        sessionId,
        content: "生成失败，请检查 Key 配置、额度或稍后重试。",
        status: "failed"
      });

      writer.send("error", {
        error:
          error instanceof Error && error.message === "Missing OPENAI_API_KEY"
            ? "缺少 OPENAI_API_KEY 配置"
            : "生成失败，请稍后重试",
        message
      });
    }
  });
}
