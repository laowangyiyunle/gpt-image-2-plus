# OpenAI Key Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight web settings entry that lets the user save one active OpenAI API key into the local SQLite database, display only a masked value, and make image routes read database config before falling back to environment variables.

**Architecture:** Extend the existing `better-sqlite3` runtime database with a tiny `runtime_config` key-value table. Add three Node route handlers for reading, saving, and testing the OpenAI key, then add a minimal settings mode in the current single-page shell with a form that never re-displays the full saved key.

**Tech Stack:** Next.js App Router, React, TypeScript, better-sqlite3, OpenAI Node SDK, Zod

---

## File Structure

Planned files and responsibilities:

- `lib/db/sqlite.ts`: create the new `runtime_config` table during database initialization
- `lib/validations/settings.ts`: validate API key payloads for save and test actions
- `lib/services/runtime-config-service.ts`: read, write, and mask the saved OpenAI key
- `lib/openai/client.ts`: read database config first, then fall back to `OPENAI_API_KEY`
- `app/api/settings/openai-key/route.ts`: `GET` current key status and `PUT` save/update current key
- `app/api/settings/openai-key/test/route.ts`: test a provided key or the saved current key
- `components/settings/openai-key-settings.tsx`: settings UI card and form
- `components/chat/chat-shell.tsx`: add navigation state between chat view and settings view
- `components/history/session-sidebar.tsx`: add “图片对话 / 设置” navigation controls
- `README.md`: document web-based key configuration and fallback behavior

## Task 1: Extend the SQLite schema and runtime config service

**Files:**
- Modify: `lib/db/sqlite.ts`
- Create: `lib/services/runtime-config-service.ts`
- Create: `lib/validations/settings.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Add the runtime config table in SQLite initialization**

```ts
// append inside initializeDatabase() in lib/db/sqlite.ts
db.exec(`
  CREATE TABLE IF NOT EXISTS runtime_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
```

- [ ] **Step 2: Add settings validation schemas**

```ts
// lib/validations/settings.ts
import { z } from "zod";

export const saveOpenAIKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(400)
});

export const testOpenAIKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(400).optional()
});
```

- [ ] **Step 3: Add runtime config read/write helpers**

```ts
// lib/services/runtime-config-service.ts
import { nowIso } from "@/lib/db/helpers";
import { getDb } from "@/lib/db/sqlite";

const OPENAI_KEY_NAME = "openai_api_key";

function maskOpenAIKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "已配置";
  }

  return `${trimmed.slice(0, 3)}-****${trimmed.slice(-4)}`;
}

export function getStoredOpenAIKey() {
  const db = getDb();
  const row = db
    .prepare(`SELECT value, updated_at FROM runtime_config WHERE key = ?`)
    .get(OPENAI_KEY_NAME) as { value: string; updated_at: string } | undefined;

  if (!row) {
    return null;
  }

  return {
    value: row.value,
    updatedAt: row.updated_at,
    maskedKey: maskOpenAIKey(row.value)
  };
}

export function upsertOpenAIKey(apiKey: string) {
  const db = getDb();
  const now = nowIso();

  db.prepare(`
    INSERT INTO runtime_config (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(OPENAI_KEY_NAME, apiKey.trim(), now);

  return {
    updatedAt: now,
    maskedKey: maskOpenAIKey(apiKey)
  };
}

export function getOpenAIKeyStatus() {
  const stored = getStoredOpenAIKey();

  if (stored) {
    return {
      configured: true,
      maskedKey: stored.maskedKey,
      source: "database" as const
    };
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) {
    return {
      configured: true,
      maskedKey: maskOpenAIKey(envKey),
      source: "env" as const
    };
  }

  return {
    configured: false,
    maskedKey: "",
    source: "none" as const
  };
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`  
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add lib/db/sqlite.ts lib/services/runtime-config-service.ts lib/validations/settings.ts
git commit -m "feat: add runtime config storage for openai key"
```

## Task 2: Make the OpenAI client read database config before env fallback

**Files:**
- Modify: `lib/openai/client.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Replace env-only lookup with database-first lookup**

```ts
// lib/openai/client.ts
import OpenAI from "openai";
import { getStoredOpenAIKey } from "@/lib/services/runtime-config-service";

export function resolveOpenAIKey() {
  const stored = getStoredOpenAIKey();

  if (stored?.value) {
    return stored.value;
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }

  throw new Error("Missing OPENAI_API_KEY");
}

export function getOpenAIClient() {
  return new OpenAI({ apiKey: resolveOpenAIKey() });
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`  
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add lib/openai/client.ts
git commit -m "feat: load openai key from database first"
```

## Task 3: Add settings APIs for status, save, and connectivity test

**Files:**
- Create: `app/api/settings/openai-key/route.ts`
- Create: `app/api/settings/openai-key/test/route.ts`
- Test: manual API checks with curl or PowerShell

- [ ] **Step 1: Add the status and save route**

```ts
// app/api/settings/openai-key/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getOpenAIKeyStatus,
  upsertOpenAIKey
} from "@/lib/services/runtime-config-service";
import { saveOpenAIKeySchema } from "@/lib/validations/settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getOpenAIKeyStatus());
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = saveOpenAIKeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "API Key 格式不合法" }, { status: 400 });
  }

  const saved = upsertOpenAIKey(parsed.data.apiKey);
  return NextResponse.json({
    configured: true,
    maskedKey: saved.maskedKey,
    source: "database"
  });
}
```

- [ ] **Step 2: Add the connectivity test route**

```ts
// app/api/settings/openai-key/test/route.ts
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getStoredOpenAIKey } from "@/lib/services/runtime-config-service";
import { testOpenAIKeySchema } from "@/lib/validations/settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = testOpenAIKeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "API Key 格式不合法" }, { status: 400 });
  }

  const candidate = parsed.data.apiKey?.trim() || getStoredOpenAIKey()?.value || "";
  if (!candidate) {
    return NextResponse.json({ ok: false, message: "当前没有可测试的 API Key" }, { status: 400 });
  }

  try {
    const client = new OpenAI({ apiKey: candidate });
    await client.models.list();
    return NextResponse.json({ ok: true, message: "API Key 可用" });
  } catch {
    return NextResponse.json({ ok: false, message: "API Key 不可用或请求失败" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Verify the settings APIs**

Run: `Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/settings/openai-key`  
Expected: JSON with `configured`, `maskedKey`, `source`

Run: `Invoke-WebRequest -UseBasicParsing -Method Put -Uri http://localhost:3000/api/settings/openai-key -ContentType 'application/json' -Body '{"apiKey":"sk-test-1234567890abcd"}'`  
Expected: JSON with `configured: true`, masked key, and `source: "database"`

Run: `Invoke-WebRequest -UseBasicParsing -Method Post -Uri http://localhost:3000/api/settings/openai-key/test -ContentType 'application/json' -Body '{}'`  
Expected: JSON response with `ok` and Chinese `message`

- [ ] **Step 4: Commit**

```bash
git add app/api/settings
git commit -m "feat: add openai key settings apis"
```

## Task 4: Add the settings page UI and navigation

**Files:**
- Create: `components/settings/openai-key-settings.tsx`
- Modify: `components/chat/chat-shell.tsx`
- Modify: `components/history/session-sidebar.tsx`
- Modify: `app/globals.css`
- Test: manual browser verification

- [ ] **Step 1: Add the settings card component**

```tsx
// components/settings/openai-key-settings.tsx
"use client";

import { useEffect, useState } from "react";

type KeyStatus = {
  configured: boolean;
  maskedKey: string;
  source: "database" | "env" | "none";
};

export function OpenAIKeySettings() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    const res = await fetch("/api/settings/openai-key");
    const data = await res.json();
    setStatus(data);
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/settings/openai-key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey })
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setMessage(data.error || "保存失败");
      return;
    }

    setApiKey("");
    setStatus(data);
    setMessage("保存成功");
  }

  async function handleTest() {
    setMessage("");
    const res = await fetch("/api/settings/openai-key/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiKey ? { apiKey } : {})
    });
    const data = await res.json();
    setMessage(data.message || "测试完成");
  }

  return (
    <section className="settings-panel">
      <div className="settings-card">
        <h2>OpenAI API Key</h2>
        <p>当前状态：{status?.configured ? "已配置" : "未配置"}</p>
        <p>当前来源：{status?.source ?? "none"}</p>
        <p>当前 Key：{status?.maskedKey || "未配置"}</p>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="输入新的 OpenAI API Key"
        />
        <div className="settings-actions">
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
          <button type="button" onClick={handleTest}>
            测试连接
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add navigation state in the shell**

```tsx
// in components/chat/chat-shell.tsx
type ViewMode = "chat" | "settings";

const [viewMode, setViewMode] = useState<ViewMode>("chat");

// sidebar props
<SessionSidebar
  ...
  viewMode={viewMode}
  onChangeView={setViewMode}
/>

// render area
{viewMode === "chat" ? (
  <>
    <header className="chat-header">...</header>
    <MessageList ... />
    <ChatComposer ... />
  </>
) : (
  <OpenAIKeySettings />
)}
```

- [ ] **Step 3: Add sidebar navigation buttons**

```tsx
// in components/history/session-sidebar.tsx
type SessionSidebarProps = {
  ...
  viewMode: "chat" | "settings";
  onChangeView: (mode: "chat" | "settings") => void;
};

<div className="sidebar-nav">
  <button type="button" onClick={() => onChangeView("chat")}>
    图片对话
  </button>
  <button type="button" onClick={() => onChangeView("settings")}>
    设置
  </button>
</div>
```

- [ ] **Step 4: Add minimal settings styles**

```css
/* append to app/globals.css */
.settings-panel {
  padding: 24px 28px;
}

.settings-card {
  max-width: 640px;
  border: 1px solid #d7dfef;
  border-radius: 20px;
  background: #fff;
  padding: 24px;
}

.settings-card input {
  width: 100%;
  margin-top: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  padding: 12px 14px;
}

.settings-actions {
  display: flex;
  gap: 12px;
  margin-top: 14px;
}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`  
Expected:
- sidebar shows both “图片对话” and “设置”
- settings view shows status, source, masked key, input, save, and test controls
- saved key does not reappear in full after refresh

- [ ] **Step 6: Commit**

```bash
git add components/settings components/chat/chat-shell.tsx components/history/session-sidebar.tsx app/globals.css
git commit -m "feat: add web settings ui for openai key"
```

## Task 5: Update docs and verify database-priority behavior

**Files:**
- Modify: `README.md`
- Test: build, typecheck, and manual config precedence checks

- [ ] **Step 1: Document the new configuration flow**

```md
## API Key 配置

支持两种方式：

1. 网页设置页保存到本地数据库（优先使用）
2. `.env.local` 中的 `OPENAI_API_KEY`（数据库未配置时回退使用）

设置页不会回显完整 Key，只显示脱敏值。
```

- [ ] **Step 2: Run final verification**

Run: `npm run typecheck`  
Expected: no TypeScript errors

Run: `npm run build`  
Expected: production build succeeds

Run: `Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/settings/openai-key` after saving a key  
Expected: `source` is `database` and `maskedKey` is returned

Run: `Invoke-WebRequest -UseBasicParsing -Method Post -Uri http://localhost:3000/api/images/generate -ContentType 'application/json' -Body '{"sessionId":"<session-id>","prompt":"测试"}'` with database key configured  
Expected: route no longer returns the missing-key error caused by env absence

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe database-backed openai key settings"
```

## Self-Review

Spec coverage check:

- Settings entry in sidebar: covered in Task 4
- Database-backed single active key: covered in Task 1 and Task 2
- Masked key display: covered in Task 1, Task 3, and Task 4
- Save API: covered in Task 3
- Connectivity test API: covered in Task 3
- Database-first, env-fallback loading: covered in Task 2 and Task 5

Placeholder scan:

- No `TODO` or `TBD` placeholders remain
- All modified files are explicit
- Code steps include concrete code blocks
- Verification steps include exact commands and expected outcomes

Type consistency check:

- `runtime_config` table matches `getStoredOpenAIKey()` usage
- `maskedKey` and `source` names are used consistently across service, API, and UI
- `openai_api_key` is the only saved config key throughout the plan
