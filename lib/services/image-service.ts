import { toFile } from "openai/uploads";
import { getOpenAIClient } from "@/lib/openai/client";
import { IMAGE_GENERATION_MODEL } from "@/lib/openai/image-model";
import {
  extensionFromMimeType,
  saveBufferAsFile
} from "@/lib/storage/file-storage";

function extractBase64Images(response: {
  data?: Array<{ b64_json?: string }>;
}) {
  const buffers =
    response.data
      ?.map((item) => item.b64_json)
      .filter((base64): base64 is string => Boolean(base64))
      .map((base64) => Buffer.from(base64, "base64")) ?? [];

  if (buffers.length === 0) {
    throw new Error("Image API returned no base64 image data");
  }

  return buffers;
}

export function saveGeneratedBase64Image(base64: string, extension = "png") {
  return saveBufferAsFile(Buffer.from(base64, "base64"), "generated", extension);
}

export async function generateImageFromPrompt(args: {
  prompt: string;
  size?: string;
  quality?: string;
  count?: number;
}) {
  const client = getOpenAIClient();
  const response = await client.images.generate({
    model: IMAGE_GENERATION_MODEL,
    prompt: args.prompt,
    size: (args.size as "1024x1024" | "1536x1024" | "1024x1536" | "auto" | undefined) ?? "auto",
    quality:
      (args.quality as "low" | "medium" | "high" | "auto" | undefined) ?? "auto",
    n: args.count ?? 1
  });

  const buffers = extractBase64Images(response);
  return Promise.all(
    buffers.map((buffer) => saveBufferAsFile(buffer, "generated", "png"))
  );
}

export async function streamImagesFromPrompt(args: {
  prompt: string;
  size?: string;
  quality?: string;
  count?: number;
}) {
  const client = getOpenAIClient();

  return client.images.generate({
    model: IMAGE_GENERATION_MODEL,
    prompt: args.prompt,
    size: (args.size as "1024x1024" | "1536x1024" | "1024x1536" | "auto" | undefined) ?? "auto",
    quality:
      (args.quality as "low" | "medium" | "high" | "auto" | undefined) ?? "auto",
    n: args.count ?? 1,
    partial_images: 2,
    stream: true
  });
}

export async function generateImageFromEdit(args: {
  prompt: string;
  imageBuffer: Buffer;
  imageMimeType: string;
  size?: string;
  quality?: string;
  count?: number;
}) {
  const client = getOpenAIClient();
  const extension = extensionFromMimeType(args.imageMimeType);

  const response = await client.images.edit({
    model: IMAGE_GENERATION_MODEL,
    prompt: args.prompt,
    image: await toFile(args.imageBuffer, `input.${extension}`, {
      type: args.imageMimeType
    }),
    size: (args.size as "1024x1024" | "1536x1024" | "1024x1536" | "auto" | undefined) ?? "auto",
    quality:
      (args.quality as "low" | "medium" | "high" | "auto" | undefined) ?? "auto",
    n: args.count ?? 1
  });

  const buffers = extractBase64Images(response);
  return Promise.all(
    buffers.map((buffer) => saveBufferAsFile(buffer, "generated", "png"))
  );
}

export async function streamImagesFromEdit(args: {
  prompt: string;
  imageBuffer: Buffer;
  imageMimeType: string;
  size?: string;
  quality?: string;
  count?: number;
}) {
  const client = getOpenAIClient();
  const extension = extensionFromMimeType(args.imageMimeType);

  return client.images.edit({
    model: IMAGE_GENERATION_MODEL,
    prompt: args.prompt,
    image: await toFile(args.imageBuffer, `input.${extension}`, {
      type: args.imageMimeType
    }),
    size: (args.size as "1024x1024" | "1536x1024" | "1024x1536" | "auto" | undefined) ?? "auto",
    quality:
      (args.quality as "low" | "medium" | "high" | "auto" | undefined) ?? "auto",
    n: args.count ?? 1,
    partial_images: 2,
    stream: true
  });
}
