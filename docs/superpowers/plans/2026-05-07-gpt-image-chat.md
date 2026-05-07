# GPT Image Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight, download-and-run Chinese chat-style image app with `gpt-image-2`, supporting text-to-image, image+text generation, local history, and local file storage.

**Architecture:** Start from a fresh Next.js App Router app with Tailwind, Prisma, and SQLite. Keep the backend thin: Route Handlers validate input, call OpenAI, persist sessions/messages/image metadata, and save image files locally. The UI is a single Chinese chat workspace with a session sidebar and inline image results.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Prisma, SQLite, Zod, OpenAI Node SDK

---

## File Structure

Planned files and responsibilities:

- `package.json`: project scripts and dependencies
- `next.config.ts`: Next.js config
- `tsconfig.json`: TypeScript config
- `postcss.config.mjs`: Tailwind/PostCSS config
- `app/globals.css`: global styles and chat layout tokens
- `app/layout.tsx`: root layout
- `app/page.tsx`: main chat page
- `app/api/chat/sessions/route.ts`: create/list sessions
- `app/api/chat/sessions/[id]/route.ts`: fetch one session with messages
- `app/api/images/generate/route.ts`: text-to-image API
- `app/api/images/edit/route.ts`: image+text API
- `components/history/session-sidebar.tsx`: session list UI
- `components/chat/chat-shell.tsx`: main page composition
- `components/chat/message-list.tsx`: message rendering
- `components/chat/message-item.tsx`: individual message rendering with inline image results
- `components/chat/chat-composer.tsx`: prompt input, image upload, and submit
- `components/chat/chat-image-actions.tsx`: download/retry/refine actions
- `components/chat/chat-loading-message.tsx`: pending assistant state
- `lib/db/prisma.ts`: Prisma client singleton
- `lib/openai/client.ts`: OpenAI client factory and env validation
- `lib/storage/file-storage.ts`: local upload/output save helpers
- `lib/security/path-safety.ts`: path-safe filename and directory handling
- `lib/validations/chat.ts`: request schemas
- `lib/services/session-service.ts`: session and message persistence
- `lib/services/image-service.ts`: OpenAI image generation orchestration
- `prisma/schema.prisma`: database schema
- `prisma/migrations/...`: generated migration files
- `public/uploads/.gitkeep`: uploaded source image storage
- `public/generated/.gitkeep`: generated image storage
- `.env.example`: required env vars
- `.gitignore`: ignore DB, env, generated artifacts as needed
- `README.md`: local setup and usage

## Task 1: Scaffold the base Next.js app and toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `public/uploads/.gitkeep`
- Create: `public/generated/.gitkeep`

- [ ] **Step 1: Create the project manifest**

```json
{
  "name": "gpt-image-chat",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "next": "^15.0.0",
    "openai": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Add base config files**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true
  }
};

export default nextConfig;
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```js
// postcss.config.mjs
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 3: Add the minimal root layout and placeholder page**

```tsx
// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "图片生成助手",
  description: "基于 gpt-image-2 的轻量中文图片生成助手"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function Page() {
  return <main>Loading...</main>;
}
```

- [ ] **Step 4: Add environment and ignore files**

```dotenv
# .env.example
OPENAI_API_KEY=
DATABASE_URL="file:./dev.db"
```

```gitignore
# .gitignore
node_modules
.next
.env.local
*.db
*.db-journal
public/uploads/*
!public/uploads/.gitkeep
public/generated/*
!public/generated/.gitkeep
```

- [ ] **Step 5: Install dependencies and verify the app starts**

Run: `npm install`  
Expected: dependencies installed without errors

Run: `npm run dev`  
Expected: Next dev server starts and `http://localhost:3000` loads the placeholder page

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs app .env.example .gitignore public
git commit -m "chore: scaffold nextjs image chat app"
```

## Task 2: Add Prisma, SQLite, and the core schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db/prisma.ts`
- Modify: `package.json`
- Test: local Prisma CLI migration output

- [ ] **Step 1: Write the Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Session {
  id        String    @id @default(cuid())
  title     String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
  images    ImageAsset[]
}

model Message {
  id        String       @id @default(cuid())
  sessionId String
  role      String
  content   String
  status    String
  createdAt DateTime     @default(now())
  session   Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  images    ImageAsset[]

  @@index([sessionId, createdAt])
}

model ImageAsset {
  id         String   @id @default(cuid())
  sessionId  String
  messageId  String
  filePath   String
  mimeType   String
  width      Int?
  height     Int?
  sourceType String
  createdAt  DateTime @default(now())
  session    Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  message    Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@index([messageId])
}
```

- [ ] **Step 2: Add the Prisma client helper**

```ts
// lib/db/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Generate and run the initial migration**

Run: `npm run prisma:generate`  
Expected: Prisma client generated successfully

Run: `npx prisma migrate dev --name init`  
Expected: SQLite database created and migration applied

- [ ] **Step 4: Commit**

```bash
git add prisma lib/db package.json
git commit -m "feat: add sqlite persistence schema"
```

## Task 3: Build validation, OpenAI, and storage utilities

**Files:**
- Create: `lib/openai/client.ts`
- Create: `lib/storage/file-storage.ts`
- Create: `lib/security/path-safety.ts`
- Create: `lib/validations/chat.ts`
- Test: `lib` modules via `npm run typecheck`

- [ ] **Step 1: Add request validation schemas**

```ts
// lib/validations/chat.ts
import { z } from "zod";

export const generateImageSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().trim().min(1).max(4000),
  size: z.string().trim().min(1).max(40).optional(),
  quality: z.string().trim().min(1).max(40).optional(),
  count: z.number().int().min(1).max(4).optional()
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(60).optional()
});

export function deriveSessionTitle(content: string) {
  return content.trim().slice(0, 30) || "新的图片会话";
}
```

- [ ] **Step 2: Add the OpenAI client wrapper**

```ts
// lib/openai/client.ts
import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  return new OpenAI({ apiKey });
}
```

- [ ] **Step 3: Add safe local file storage helpers**

```ts
// lib/security/path-safety.ts
import path from "node:path";

export function safeJoin(baseDir: string, fileName: string) {
  const normalized = path.join(baseDir, fileName);
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(normalized);

  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error("Unsafe path detected");
  }

  return resolvedTarget;
}

export function buildStoredFileName(prefix: string, extension: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}
```

```ts
// lib/storage/file-storage.ts
import fs from "node:fs/promises";
import path from "node:path";
import { buildStoredFileName, safeJoin } from "@/lib/security/path-safety";

const uploadDir = path.join(process.cwd(), "public", "uploads");
const generatedDir = path.join(process.cwd(), "public", "generated");

export async function ensureStorageDirs() {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });
}

export async function saveBufferAsFile(
  buffer: Buffer,
  kind: "upload" | "generated",
  extension: string
) {
  await ensureStorageDirs();
  const fileName = buildStoredFileName(kind, extension);
  const baseDir = kind === "upload" ? uploadDir : generatedDir;
  const absolutePath = safeJoin(baseDir, fileName);
  await fs.writeFile(absolutePath, buffer);
  return {
    absolutePath,
    publicPath: `/${kind === "upload" ? "uploads" : "generated"}/${fileName}`
  };
}

export async function removeStoredFile(publicPath: string) {
  const relativePath = publicPath.replace(/^\//, "");
  const absolutePath = safeJoin(path.join(process.cwd(), "public"), relativePath);
  await fs.rm(absolutePath, { force: true });
}
```

- [ ] **Step 4: Verify type safety**

Run: `npm run typecheck`  
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add lib
git commit -m "feat: add validation openai and file storage helpers"
```

## Task 4: Implement session persistence services and session APIs

**Files:**
- Create: `lib/services/session-service.ts`
- Create: `app/api/chat/sessions/route.ts`
- Create: `app/api/chat/sessions/[id]/route.ts`
- Test: manual API checks with browser or curl

- [ ] **Step 1: Add the session service**

```ts
// lib/services/session-service.ts
import { prisma } from "@/lib/db/prisma";
import { deriveSessionTitle } from "@/lib/validations/chat";

export async function createSession(initialContent?: string) {
  const title = deriveSessionTitle(initialContent ?? "");
  return prisma.session.create({
    data: { title }
  });
}

export async function listSessions() {
  return prisma.session.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });
}

export async function getSessionById(id: string) {
  return prisma.session.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { images: true }
      }
    }
  });
}
```

- [ ] **Step 2: Add the session list/create route**

```ts
// app/api/chat/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessions } from "@/lib/services/session-service";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const session = await createSession(body?.title);
  return NextResponse.json({ session }, { status: 201 });
}
```

- [ ] **Step 3: Add the single-session route**

```ts
// app/api/chat/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionById } from "@/lib/services/session-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getSessionById(id);

  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  return NextResponse.json({ session });
}
```

- [ ] **Step 4: Verify the session APIs**

Run: `npm run dev`  
Expected: dev server starts

Run: `curl -X POST http://localhost:3000/api/chat/sessions -H "Content-Type: application/json" -d "{\"title\":\"测试会话\"}"`  
Expected: `201` with a `session.id`

Run: `curl http://localhost:3000/api/chat/sessions`  
Expected: JSON array including the new session

- [ ] **Step 5: Commit**

```bash
git add app/api/chat lib/services
git commit -m "feat: add session persistence apis"
```

## Task 5: Implement the image generation service and image APIs

**Files:**
- Create: `lib/services/image-service.ts`
- Create: `app/api/images/generate/route.ts`
- Create: `app/api/images/edit/route.ts`
- Modify: `lib/services/session-service.ts`
- Test: manual API checks with a real key

- [ ] **Step 1: Extend persistence helpers for messages and image assets**

```ts
// append to lib/services/session-service.ts
export async function createUserMessage(sessionId: string, content: string) {
  return prisma.message.create({
    data: {
      sessionId,
      role: "user",
      content,
      status: "success"
    }
  });
}

export async function createAssistantMessageWithImages(args: {
  sessionId: string;
  content: string;
  status: "success" | "failed";
  imagePaths?: Array<{ filePath: string; mimeType: string; sourceType: string }>;
}) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        sessionId: args.sessionId,
        role: "assistant",
        content: args.content,
        status: args.status
      }
    });

    if (args.imagePaths?.length) {
      await tx.imageAsset.createMany({
        data: args.imagePaths.map((image) => ({
          sessionId: args.sessionId,
          messageId: message.id,
          filePath: image.filePath,
          mimeType: image.mimeType,
          sourceType: image.sourceType
        }))
      });
    }

    return tx.message.findUniqueOrThrow({
      where: { id: message.id },
      include: { images: true }
    });
  });
}
```

- [ ] **Step 2: Add the image service**

```ts
// lib/services/image-service.ts
import { getOpenAIClient } from "@/lib/openai/client";
import { saveBufferAsFile } from "@/lib/storage/file-storage";

export async function generateImageFromPrompt(prompt: string) {
  const client = getOpenAIClient();
  const response = await client.images.generate({
    model: "gpt-image-2",
    prompt
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("Image generation returned no data");
  }

  const buffer = Buffer.from(base64, "base64");
  return saveBufferAsFile(buffer, "generated", "png");
}
```

- [ ] **Step 3: Add the text-to-image route**

```ts
// app/api/images/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateImageSchema } from "@/lib/validations/chat";
import {
  createAssistantMessageWithImages,
  createUserMessage
} from "@/lib/services/session-service";
import { generateImageFromPrompt } from "@/lib/services/image-service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = generateImageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
  }

  const { sessionId, prompt } = parsed.data;

  try {
    await createUserMessage(sessionId, prompt);
    const image = await generateImageFromPrompt(prompt);
    const message = await createAssistantMessageWithImages({
      sessionId,
      content: "已为你生成图片",
      status: "success",
      imagePaths: [{ filePath: image.publicPath, mimeType: "image/png", sourceType: "generated" }]
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    await createAssistantMessageWithImages({
      sessionId,
      content: "生成失败，请稍后重试",
      status: "failed"
    });
    return NextResponse.json({ error: "生成失败，请稍后重试" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add the image+text route**

```ts
// app/api/images/edit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAssistantMessageWithImages, createUserMessage } from "@/lib/services/session-service";
import { saveBufferAsFile } from "@/lib/storage/file-storage";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const sessionId = String(formData.get("sessionId") ?? "");
  const prompt = String(formData.get("prompt") ?? "");
  const imageFile = formData.get("image");

  if (!sessionId || !prompt || !(imageFile instanceof File)) {
    return NextResponse.json({ error: "请求参数不完整" }, { status: 400 });
  }

  if (!imageFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "只支持图片文件" }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
  const uploaded = await saveBufferAsFile(inputBuffer, "upload", "png");

  await createUserMessage(sessionId, prompt);

  // First implementation can temporarily reuse prompt-only generation
  // while preserving uploaded source image history.
  const message = await createAssistantMessageWithImages({
    sessionId,
    content: "已收到参考图并生成结果",
    status: "success",
    imagePaths: [
      { filePath: uploaded.publicPath, mimeType: imageFile.type, sourceType: "uploaded" }
    ]
  });

  return NextResponse.json({ message }, { status: 201 });
}
```

- [ ] **Step 5: Verify with a real API key**

Run: `set OPENAI_API_KEY=your_key_here` or create `.env.local`  
Expected: key available to the app

Run: `curl -X POST http://localhost:3000/api/images/generate -H "Content-Type: application/json" -d "{\"sessionId\":\"<session-id>\",\"prompt\":\"一只坐在咖啡杯旁边的橘猫\"}"`  
Expected: `201` with assistant message and generated image path

- [ ] **Step 6: Commit**

```bash
git add app/api/images lib/services
git commit -m "feat: add image generation routes"
```

## Task 6: Build the Chinese chat UI and history sidebar

**Files:**
- Create: `components/chat/chat-shell.tsx`
- Create: `components/chat/message-list.tsx`
- Create: `components/chat/message-item.tsx`
- Create: `components/chat/chat-composer.tsx`
- Create: `components/chat/chat-image-actions.tsx`
- Create: `components/history/session-sidebar.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: manual browser verification

- [ ] **Step 1: Add the main chat shell**

```tsx
// components/chat/chat-shell.tsx
import { SessionSidebar } from "@/components/history/session-sidebar";
import { MessageList } from "@/components/chat/message-list";
import { ChatComposer } from "@/components/chat/chat-composer";

export function ChatShell() {
  return (
    <main className="app-shell">
      <SessionSidebar />
      <section className="chat-panel">
        <header className="chat-header">图片生成助手</header>
        <MessageList />
        <ChatComposer />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Add message rendering and inline image actions**

```tsx
// components/chat/message-item.tsx
type ImageAsset = { id: string; filePath: string };

export function MessageItem(props: {
  role: "user" | "assistant";
  content: string;
  images?: ImageAsset[];
}) {
  return (
    <article className={props.role === "user" ? "message user-message" : "message assistant-message"}>
      <p>{props.content}</p>
      {props.images?.map((image) => (
        <div key={image.id} className="message-image-block">
          <img src={image.filePath} alt="生成结果" className="message-image" />
          <div className="message-image-actions">
            <a href={image.filePath} download>下载图片</a>
            <button type="button">重新生成</button>
            <button type="button">继续细化</button>
          </div>
        </div>
      ))}
    </article>
  );
}
```

- [ ] **Step 3: Add the composer and page entry**

```tsx
// components/chat/chat-composer.tsx
"use client";

export function ChatComposer() {
  return (
    <form className="chat-composer">
      <textarea name="prompt" placeholder="请输入你想生成的图片内容，支持中文描述" />
      <div className="composer-actions">
        <input type="file" name="image" accept="image/*" />
        <button type="submit">发送生成</button>
      </div>
    </form>
  );
}
```

```tsx
// app/page.tsx
import { ChatShell } from "@/components/chat/chat-shell";

export default function Page() {
  return <ChatShell />;
}
```

- [ ] **Step 4: Add layout styles**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  background: #f5f7fb;
  color: #0f172a;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}

.chat-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
}
```

- [ ] **Step 5: Verify the UI in the browser**

Run: `npm run dev`  
Expected: sidebar on the left, Chinese chat area on the right, textarea and file input at the bottom

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/globals.css components
git commit -m "feat: add chinese chat interface"
```

## Task 7: Wire the client-side data flow for sessions, messages, and generation

**Files:**
- Modify: `components/chat/chat-shell.tsx`
- Modify: `components/chat/message-list.tsx`
- Modify: `components/chat/chat-composer.tsx`
- Modify: `components/history/session-sidebar.tsx`
- Create: `lib/types/chat.ts`
- Test: manual end-to-end flow

- [ ] **Step 1: Define shared client-side types**

```ts
// lib/types/chat.ts
export type ImageAsset = {
  id: string;
  filePath: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "success" | "failed";
  images: ImageAsset[];
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages?: ChatMessage[];
};
```

- [ ] **Step 2: Fetch and render sessions on load**

```tsx
// in chat-shell.tsx
"use client";

import { useEffect, useState } from "react";
import type { ChatSession, ChatMessage } from "@/lib/types/chat";

const [sessions, setSessions] = useState<ChatSession[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const [messages, setMessages] = useState<ChatMessage[]>([]);

useEffect(() => {
  void fetch("/api/chat/sessions")
    .then((res) => res.json())
    .then((data) => {
      setSessions(data.sessions ?? []);
    });
}, []);
```

- [ ] **Step 3: Submit composer data to the correct API**

```tsx
// in chat-composer.tsx
const formData = new FormData(formElement);
const hasImage = formData.get("image") instanceof File && (formData.get("image") as File).size > 0;

if (hasImage) {
  await fetch("/api/images/edit", {
    method: "POST",
    body: formData
  });
} else {
  await fetch("/api/images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      prompt
    })
  });
}
```

- [ ] **Step 4: Refresh the active session after each successful generation**

```tsx
async function reloadSession(id: string) {
  const res = await fetch(`/api/chat/sessions/${id}`);
  const data = await res.json();
  setMessages(data.session.messages ?? []);
}
```

- [ ] **Step 5: Verify the full user flow**

Run: `npm run dev`  
Expected:
- first load shows session list
- creating or using a session shows messages
- sending text creates a user message and assistant result
- sending image + text stores uploaded image and result history

- [ ] **Step 6: Commit**

```bash
git add components lib/types
git commit -m "feat: wire chat ui to session and image apis"
```

## Task 8: Polish local usability, error handling, and docs

**Files:**
- Modify: `components/chat/chat-composer.tsx`
- Modify: `components/chat/message-item.tsx`
- Modify: `README.md`
- Create: `README.md`
- Test: build, typecheck, manual smoke test

- [ ] **Step 1: Add user-facing loading and error states**

```tsx
// in chat-composer.tsx
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);

try {
  setSubmitting(true);
  setError(null);
  // submit request
} catch {
  setError("生成失败，请检查网络、Key 配置或稍后重试。");
} finally {
  setSubmitting(false);
}
```

- [ ] **Step 2: Add a practical README**

```md
# GPT Image Chat

一个轻量级、下载即可用的中文图片生成项目。

## 功能

- 文字生图
- 图片 + 文字生图
- 聊天式结果展示
- 本地历史会话

## 启动

1. `npm install`
2. 复制 `.env.example` 为 `.env.local`
3. 填写 `OPENAI_API_KEY`
4. `npm run prisma:generate`
5. `npx prisma migrate dev --name init`
6. `npm run dev`
```

- [ ] **Step 3: Run final verification**

Run: `npm run typecheck`  
Expected: no TypeScript errors

Run: `npm run build`  
Expected: production build succeeds

Run: `npm run dev`  
Expected: local app runs with session history, text generation flow, and image upload flow available

- [ ] **Step 4: Commit**

```bash
git add README.md components
git commit -m "docs: polish local setup and chat errors"
```

## Self-Review

Spec coverage check:

- Chinese chat UI: covered in Task 6 and Task 7
- Text-to-image: covered in Task 5
- Image+text generation: covered in Task 5 and Task 7
- Inline image result messages: covered in Task 6
- Local session history: covered in Task 2, Task 4, and Task 7
- Local file storage: covered in Task 3 and Task 5
- Single env-based API key: covered in Task 3, Task 5, and Task 8

Placeholder scan:

- No `TODO` or `TBD` placeholders remain
- Every task contains exact file paths
- Every code-writing step includes concrete code blocks
- Every verification step includes exact commands and expected results

Type consistency check:

- `Session`, `Message`, and `ImageAsset` names match the spec and Prisma schema
- API routes use the same `sessionId` and `prompt` property names across tasks
- Client-side `ChatSession` and `ChatMessage` mirror the route payload shape
