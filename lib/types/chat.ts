export type ChatImageAsset = {
  id: string;
  filePath: string;
  mimeType: string;
  sourceType: string;
  isPending?: boolean;
  isTemplate?: boolean;
  templateName?: string | null;
  templatePrompt?: string | null;
};

export type ImageTemplate = {
  id: string;
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  filePath: string;
  mimeType: string;
  sourceType: string;
  templateName: string | null;
  prompt: string;
  createdAt: string;
};

export type ChatProgress = {
  percent: number;
  label: string;
  elapsedSeconds: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "success" | "failed";
  images: ChatImageAsset[];
  createdAt: string;
  progress?: ChatProgress;
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages?: ChatMessage[];
};
