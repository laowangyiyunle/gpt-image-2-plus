import {
  generateImageFromEdit,
  generateImageFromPrompt
} from "@/lib/services/image-service";
import type { StoredImageInput } from "@/lib/services/session-service";
import {
  createPendingAssistantMessage,
  createUserMessage,
  updateAssistantMessageWithImages
} from "@/lib/services/session-service";

type GenerateJobArgs = {
  sessionId: string;
  prompt: string;
  size?: string;
  quality?: string;
  count?: number;
};

type EditJobArgs = GenerateJobArgs & {
  imageBuffer: Buffer;
  imageMimeType: string;
  uploadedImage: StoredImageInput;
};

function generationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Missing OPENAI_API_KEY") {
    return "缺少 OPENAI_API_KEY 配置";
  }

  return "生成失败，请检查 Key 配置、额度或稍后重试。";
}

async function finishGenerateJob(args: GenerateJobArgs & { messageId: string }) {
  try {
    const images = await generateImageFromPrompt(args);
    await updateAssistantMessageWithImages({
      messageId: args.messageId,
      sessionId: args.sessionId,
      content: "已为你生成图片。",
      status: "success",
      images: images.map((image) => ({
        filePath: image.publicPath,
        mimeType: "image/png",
        sourceType: "generated"
      }))
    });
  } catch (error) {
    await updateAssistantMessageWithImages({
      messageId: args.messageId,
      sessionId: args.sessionId,
      content: generationErrorMessage(error),
      status: "failed"
    });
  }
}

async function finishEditJob(args: EditJobArgs & { messageId: string }) {
  try {
    const images = await generateImageFromEdit(args);
    await updateAssistantMessageWithImages({
      messageId: args.messageId,
      sessionId: args.sessionId,
      content: "已根据参考图生成新图片。",
      status: "success",
      images: [
        args.uploadedImage,
        ...images.map((image) => ({
          filePath: image.publicPath,
          mimeType: "image/png",
          sourceType: "generated"
        }))
      ]
    });
  } catch (error) {
    await updateAssistantMessageWithImages({
      messageId: args.messageId,
      sessionId: args.sessionId,
      content: generationErrorMessage(error),
      status: "failed",
      images: [args.uploadedImage]
    });
  }
}

export async function startGenerateImageJob(args: GenerateJobArgs) {
  const userMessage = await createUserMessage(args.sessionId, args.prompt);
  const assistantMessage = await createPendingAssistantMessage({
    sessionId: args.sessionId,
    content: "图片生成任务已提交，请稍等。"
  });

  void finishGenerateJob({
    ...args,
    messageId: assistantMessage.id
  }).catch((error) => {
    console.error("Failed to finish image generation job", error);
  });

  return {
    userMessage,
    assistantMessage
  };
}

export async function startEditImageJob(args: EditJobArgs) {
  const userMessage = await createUserMessage(args.sessionId, args.prompt);
  const assistantMessage = await createPendingAssistantMessage({
    sessionId: args.sessionId,
    content: "参考图生成任务已提交，请稍等。",
    images: [args.uploadedImage]
  });

  void finishEditJob({
    ...args,
    messageId: assistantMessage.id
  }).catch((error) => {
    console.error("Failed to finish image edit job", error);
  });

  return {
    userMessage,
    assistantMessage
  };
}
