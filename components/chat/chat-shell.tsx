"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChatComposer,
  type ComposerDraft
} from "@/components/chat/chat-composer";
import { MessageList } from "@/components/chat/message-list";
import { SessionSidebar } from "@/components/history/session-sidebar";
import { OpenAIKeySettings } from "@/components/settings/openai-key-settings";
import { withRecoverablePendingProgressAt } from "@/lib/chat-message-display";
import type { ChatImageAsset, ChatMessage, ChatSession } from "@/lib/types/chat";

type SessionDetailsResponse = {
  session: ChatSession & { messages: ChatMessage[] };
};

type SubmitArgs = {
  prompt: string;
  imageFile: File | null;
  size: string;
  quality: string;
  count: number;
};

type PreviewImage = {
  filePath: string;
  alt: string;
};

type KeyStatus = {
  configured: boolean;
  maskedKey: string;
  baseUrl: string;
  source: "database" | "env" | "default";
};

type ImageJobResponse = {
  userMessage: ChatMessage;
  message: ChatMessage;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }

  return data;
}

function fileNameFromPath(filePath: string, fallbackExtension: string) {
  const lastSegment = filePath.split("/").pop()?.trim();

  if (lastSegment) {
    return lastSegment;
  }

  return `reference.${fallbackExtension}`;
}

async function fileFromImageAsset(image: ChatImageAsset) {
  const response = await fetch(image.filePath);

  if (!response.ok) {
    throw new Error("无法读取原始图片，请刷新后重试。");
  }

  const blob = await response.blob();
  const mimeType = blob.type || image.mimeType || "image/png";
  const extension = mimeType.split("/")[1] || "png";

  return new File([blob], fileNameFromPath(image.filePath, extension), {
    type: mimeType
  });
}

export function ChatShell() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposerDraft | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appMessage, setAppMessage] = useState("");
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasPendingMessages = messages.some((message) => message.status === "pending");
  const isBusy = isSubmittingJob || hasPendingMessages;
  const displayMessages = useMemo(
    () => withRecoverablePendingProgressAt(messages, nowMs),
    [messages, nowMs]
  );

  async function loadSessions(selectLatest = false) {
    const data = await fetchJson<{ sessions: ChatSession[] }>("/api/chat/sessions");
    setSessions(data.sessions);

    if (!activeSessionId && data.sessions[0]) {
      setActiveSessionId(data.sessions[0].id);
      return;
    }

    if (selectLatest && data.sessions[0]) {
      setActiveSessionId(data.sessions[0].id);
    }
  }

  async function loadSession(sessionId: string) {
    const data = await fetchJson<SessionDetailsResponse>(
      `/api/chat/sessions/${sessionId}`
    );
    setMessages(data.session.messages ?? []);
  }

  async function createNewSession() {
    const data = await fetchJson<{ session: ChatSession }>("/api/chat/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    setSessions((current) => [data.session, ...current]);
    setActiveSessionId(data.session.id);
    setMessages([]);
  }

  async function handleDeleteSession(sessionId: string) {
    await fetchJson(`/api/chat/sessions/${sessionId}`, {
      method: "DELETE"
    });

    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);

    if (activeSessionId === sessionId) {
      const nextSessionId = nextSessions[0]?.id ?? null;
      setActiveSessionId(nextSessionId);
      setMessages([]);
      return;
    }

    await loadSessions();
  }

  async function handleDeleteMessage(messageId: string) {
    if (!activeSessionId) {
      return;
    }

    await fetchJson(`/api/chat/messages/${messageId}`, {
      method: "DELETE"
    });

    setMessages((current) => current.filter((message) => message.id !== messageId));
    await loadSessions();
  }

  useEffect(() => {
    void loadSessions(true);
  }, []);

  useEffect(() => {
    async function guideMissingKey() {
      const data = await fetchJson<KeyStatus>("/api/settings/openai-key");

      if (!data.configured) {
        setIsSettingsOpen(true);
        setAppMessage("请先配置 OpenAI API Key。");
      }
    }

    void guideMissingKey();
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    void loadSession(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    if (!hasPendingMessages) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasPendingMessages]);

  useEffect(() => {
    if (!activeSessionId || !hasPendingMessages) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSession(activeSessionId);
      void loadSessions();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [activeSessionId, hasPendingMessages]);

  async function handleSubmit(args: SubmitArgs) {
    let sessionId = activeSessionId;

    if (!sessionId) {
      const created = await fetchJson<{ session: ChatSession }>("/api/chat/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ initialContent: args.prompt })
      });

      sessionId = created.session.id;
      setActiveSessionId(sessionId);
      setSessions((current) => [created.session, ...current]);
    }

    if (!sessionId) {
      throw new Error("无法创建会话");
    }

    try {
      setIsSubmittingJob(true);
      let data: ImageJobResponse;

      if (args.imageFile) {
        const formData = new FormData();
        formData.set("sessionId", sessionId);
        formData.set("prompt", args.prompt);
        formData.set("image", args.imageFile);
        formData.set("size", args.size);
        formData.set("quality", args.quality);
        formData.set("count", String(args.count));

        data = await fetchJson<ImageJobResponse>("/api/images/edit/job", {
          method: "POST",
          body: formData
        });
      } else {
        data = await fetchJson<ImageJobResponse>("/api/images/generate/job", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            prompt: args.prompt,
            size: args.size,
            quality: args.quality,
            count: args.count
          })
        });
      }

      setMessages((current) =>
        [...current, data.userMessage, data.message]
      );

      await loadSessions();
    } catch (error) {
      setAppMessage(
        error instanceof Error ? error.message : "生成失败，请稍后重试。"
      );
      await loadSessions().catch(() => undefined);
      await loadSession(sessionId).catch(() => undefined);
      throw error;
    } finally {
      setIsSubmittingJob(false);
    }
  }

  function findPreviousUserMessage(targetMessageId: string) {
    const messageIndex = messages.findIndex((message) => message.id === targetMessageId);

    if (messageIndex <= 0) {
      return null;
    }

    for (let index = messageIndex - 1; index >= 0; index -= 1) {
      const message = messages[index];

      if (message.role === "user") {
        return message;
      }
    }

    return null;
  }

  async function handleReuseImage(message: ChatMessage) {
    const generatedImage = message.images.find(
      (image) => image.sourceType === "generated"
    );

    if (!generatedImage) {
      return;
    }

    const imageFile = await fileFromImageAsset(generatedImage);
    setComposerDraft({
      file: imageFile,
      focus: true,
      prompt: "",
      version: Date.now()
    });
  }

  async function handleRetry(message: ChatMessage) {
    const previousUserMessage = findPreviousUserMessage(message.id);

    if (!previousUserMessage) {
      throw new Error("未找到可重新生成的原始提示词。");
    }

    const uploadedImage = message.images.find(
      (image) => image.sourceType === "uploaded"
    );
    const imageFile = uploadedImage ? await fileFromImageAsset(uploadedImage) : null;

    await handleSubmit({
      prompt: previousUserMessage.content,
      imageFile,
      size: "auto",
      quality: "auto",
      count: 1
    });
  }

  async function runAction(action: () => Promise<void>) {
    if (isBusy) {
      return;
    }

    try {
      setAppMessage("");
      await action();
    } catch (error) {
      setAppMessage(
        error instanceof Error ? error.message : "操作失败，请稍后重试。"
      );
    }
  }

  const activeTitle = useMemo(() => {
    if (!activeSessionId) {
      return "图片生成助手";
    }

    return (
      sessions.find((session) => session.id === activeSessionId)?.title ??
      "图片生成助手"
    );
  }, [activeSessionId, sessions]);

  return (
    <main className="app-shell">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        disabled={isBusy}
        onSelect={setActiveSessionId}
        onDelete={(sessionId) => {
          void handleDeleteSession(sessionId);
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
        }}
        onCreate={() => {
          void createNewSession();
        }}
      />

      <section className="chat-panel">
        <>
          <header className="chat-header">
            <div>
              <h2>{activeTitle}</h2>
              <p>支持文字生图和图片 + 文字编辑</p>
            </div>
          </header>

          {appMessage ? (
            <div className="app-alert">
              <span>{appMessage}</span>
              <button type="button" onClick={() => setAppMessage("")}>
                关闭
              </button>
            </div>
          ) : null}

          <MessageList
            messages={displayMessages}
            disabled={isBusy}
            onReuseImage={(message) => {
              void runAction(() => handleReuseImage(message));
            }}
            onRetry={(message) => {
              void runAction(() => handleRetry(message));
            }}
            onDelete={(message) => {
              void runAction(() => handleDeleteMessage(message.id));
            }}
            onPreviewImage={(image) => {
              setPreviewImage({
                filePath: image.filePath,
                alt: image.sourceType === "uploaded" ? "参考图" : "生成结果"
              });
            }}
          />

          <ChatComposer
            activeSessionId={activeSessionId}
            draft={composerDraft}
            disabled={isBusy}
            onSubmitted={handleSubmit}
          />
        </>
      </section>

      {isSettingsOpen ? (
        <div
          className="settings-modal-backdrop"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="settings-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-modal-header">
              <div>
                <h2>设置</h2>
                <p>保存当前生效的 OpenAI API Key 和 Base URL</p>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setIsSettingsOpen(false)}
              >
                关闭
              </button>
            </div>

            <OpenAIKeySettings
              onStatusLoaded={(status) => {
                if (status.configured && appMessage === "请先配置 OpenAI API Key。") {
                  setAppMessage("");
                }
              }}
              onStorageCleared={() => {
                setSessions([]);
                setMessages([]);
                setActiveSessionId(null);
              }}
            />
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div
          className="image-preview-backdrop"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="image-preview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="image-preview-actions">
              <a href={previewImage.filePath} download>
                下载
              </a>
              <button type="button" onClick={() => setPreviewImage(null)}>
                关闭
              </button>
            </div>
            <img src={previewImage.filePath} alt={previewImage.alt} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
