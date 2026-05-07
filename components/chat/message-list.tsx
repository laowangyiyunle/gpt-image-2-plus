"use client";

import { useEffect, useRef } from "react";
import type { ChatImageAsset, ChatMessage } from "@/lib/types/chat";
import { MessageItem } from "@/components/chat/message-item";

type MessageListProps = {
  messages: ChatMessage[];
  disabled?: boolean;
  onReuseImage?: (message: ChatMessage) => void;
  onRetry?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onPreviewImage?: (image: ChatImageAsset) => void;
};

export function MessageList({
  messages,
  disabled = false,
  onReuseImage,
  onRetry,
  onDelete,
  onPreviewImage
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end"
    });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <section className="message-list empty-state">
        <div className="empty-state-card">
          <h2>开始一个新会话</h2>
          <p>输入中文描述，或者先上传一张参考图，再补充你的修改要求。</p>
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
        />
      ))}
      <div ref={bottomRef} />
    </section>
  );
}
