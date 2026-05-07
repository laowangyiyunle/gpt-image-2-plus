export type ChatImageAsset = {
  id: string;
  filePath: string;
  mimeType: string;
  sourceType: string;
  isPending?: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "success" | "failed";
  images: ChatImageAsset[];
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages?: ChatMessage[];
};
