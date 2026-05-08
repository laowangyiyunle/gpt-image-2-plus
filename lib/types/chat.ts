export type ChatImageAsset = {
  id: string;
  filePath: string;
  mimeType: string;
  sourceType: string;
  isPending?: boolean;
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
