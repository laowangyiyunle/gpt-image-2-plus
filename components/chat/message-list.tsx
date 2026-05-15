"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChatImageAsset, ChatMessage } from "@/lib/types/chat";
import { MessageItem } from "@/components/chat/message-item";

type MessageListProps = {
  messages: ChatMessage[];
  disabled?: boolean;
  onReuseImage?: (message: ChatMessage) => void;
  onRetry?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onPreviewImage?: (image: ChatImageAsset, images: ChatImageAsset[]) => void;
  onToggleTemplate?: (image: ChatImageAsset, message: ChatMessage) => void;
};

export function MessageList({
  messages,
  disabled = false,
  onReuseImage,
  onRetry,
  onDelete,
  onPreviewImage,
  onToggleTemplate
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollKey = useMemo(
    () =>
      messages
        .map((message) => `${message.id}:${message.status}:${message.images.length}`)
        .join("|"),
    [messages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end"
    });
  }, [scrollKey]);

  if (messages.length === 0) {
    return (
      <section className="message-list empty-state">
        <div className="empty-state-card">
          <h2>暂无生成记录</h2>
          <p>右侧提交后，这里会保留每次生成、失败、重试和参考图上下文。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="message-list">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          disabled={disabled}
          onReuseImage={onReuseImage}
          onRetry={onRetry}
          onDelete={onDelete}
          onPreviewImage={onPreviewImage}
          onToggleTemplate={onToggleTemplate}
        />
      ))}
      <div ref={bottomRef} />
    </section>
  );
}
