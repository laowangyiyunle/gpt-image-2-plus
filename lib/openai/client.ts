import OpenAI from "openai";
import {
  getStoredOpenAIBaseUrl,
  getStoredOpenAIKey
} from "@/lib/services/runtime-config-service";

export function resolveOpenAIKey() {
  const stored = getStoredOpenAIKey();

  if (stored?.value) {
    return stored.value;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  return apiKey;
}

export function resolveOpenAIBaseUrl() {
  const stored = getStoredOpenAIBaseUrl();

  if (stored?.value) {
    return stored.value;
  }

  const baseUrl = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
  return baseUrl || undefined;
}

export function getOpenAIClient() {
  const baseURL = resolveOpenAIBaseUrl();

  return new OpenAI({
    apiKey: resolveOpenAIKey(),
    ...(baseURL ? { baseURL } : {})
  });
}
