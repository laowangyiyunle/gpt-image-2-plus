# OpenAI Base URL Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing web settings page so the user can save a global OpenAI Base URL, have the app load it from the local SQLite config store, and use it consistently across all OpenAI client requests.

**Architecture:** Reuse the current `runtime_config` key-value table and settings API surface instead of adding a second settings system. Add one more config key, extend the settings status payload, and make the OpenAI client resolve both `apiKey` and `baseURL` from database-first config with environment-variable fallback.

**Tech Stack:** Next.js App Router, React, TypeScript, better-sqlite3, OpenAI Node SDK, Zod

---

## File Structure

Planned files and responsibilities:

- `lib/validations/settings.ts`: validate `baseUrl` input
- `lib/services/runtime-config-service.ts`: persist and read `openai_base_url`
- `lib/openai/client.ts`: resolve `baseURL` from database/env/default
- `app/api/settings/openai-key/route.ts`: include `baseUrl` in GET and PUT payloads
- `app/api/settings/openai-key/test/route.ts`: test the provided or saved `baseUrl`
- `components/settings/openai-key-settings.tsx`: add the Base URL field and render current URL
- `README.md`: document `OPENAI_BASE_URL` fallback and settings behavior

## Task 1: Extend runtime config service for Base URL

**Files:**
- Modify: `lib/validations/settings.ts`
- Modify: `lib/services/runtime-config-service.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Add Base URL validation**

```ts
// lib/validations/settings.ts
import { z } from "zod";

const baseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "Base URL 必须以 http:// 或 https:// 开头"
  )
  .transform((value) => value.replace(/\/+$/, ""));

export const saveOpenAIKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(400),
  baseUrl: baseUrlSchema.optional()
});

export const testOpenAIKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(400).optional(),
  baseUrl: baseUrlSchema.optional()
});
```

- [ ] **Step 2: Add runtime config helpers for Base URL**

```ts
// append in lib/services/runtime-config-service.ts
const OPENAI_BASE_URL_NAME = "openai_base_url";

function getConfigValue(key: string) {
  const db = getDb();
  const row = db
    .prepare(`SELECT value, updated_at FROM runtime_config WHERE key = ?`)
    .get(key) as { value: string; updated_at: string } | undefined;

  if (!row) {
    return null;
  }

  return {
    value: row.value,
    updatedAt: row.updated_at
  };
}

function upsertConfigValue(key: string, value: string) {
  const db = getDb();
  const updatedAt = nowIso();

  db.prepare(`
    INSERT INTO runtime_config (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, updatedAt);

  return updatedAt;
}

export function getStoredOpenAIBaseUrl() {
  return getConfigValue(OPENAI_BASE_URL_NAME);
}

export function upsertOpenAIBaseUrl(baseUrl: string) {
  return upsertConfigValue(OPENAI_BASE_URL_NAME, baseUrl.trim().replace(/\/+$/, ""));
}
```

- [ ] **Step 3: Extend the settings status response**

```ts
// update getOpenAIKeyStatus() in lib/services/runtime-config-service.ts
const storedKey = getStoredOpenAIKey();
const storedBaseUrl = getStoredOpenAIBaseUrl();

if (storedKey || storedBaseUrl) {
  return {
    configured: Boolean(storedKey),
    maskedKey: storedKey?.maskedKey ?? "",
    baseUrl: storedBaseUrl?.value ?? "",
    source: "database" as const
  };
}

const envKey = process.env.OPENAI_API_KEY?.trim();
const envBaseUrl = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");

if (envKey || envBaseUrl) {
  return {
    configured: Boolean(envKey),
    maskedKey: envKey ? maskOpenAIKey(envKey) : "",
    baseUrl: envBaseUrl ?? "",
    source: "env" as const
  };
}

return {
  configured: false,
  maskedKey: "",
  baseUrl: "",
  source: "default" as const
};
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`  
Expected: no TypeScript errors

## Task 2: Make the OpenAI client resolve Base URL

**Files:**
- Modify: `lib/openai/client.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Add Base URL resolution**

```ts
// lib/openai/client.ts
import OpenAI from "openai";
import {
  getStoredOpenAIBaseUrl,
  getStoredOpenAIKey
} from "@/lib/services/runtime-config-service";

export function resolveOpenAIKey() {
  const stored = getStoredOpenAIKey();
  if (stored?.value) return stored.value;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return apiKey;
}

export function resolveOpenAIBaseUrl() {
  const stored = getStoredOpenAIBaseUrl();
  if (stored?.value) return stored.value;

  const envBaseUrl = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
  return envBaseUrl || undefined;
}

export function getOpenAIClient() {
  const baseURL = resolveOpenAIBaseUrl();
  return new OpenAI({
    apiKey: resolveOpenAIKey(),
    ...(baseURL ? { baseURL } : {})
  });
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`  
Expected: no TypeScript errors

## Task 3: Extend the settings APIs for Base URL

**Files:**
- Modify: `app/api/settings/openai-key/route.ts`
- Modify: `app/api/settings/openai-key/test/route.ts`
- Test: manual API checks

- [ ] **Step 1: Save and return Base URL in the settings route**

```ts
// app/api/settings/openai-key/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getOpenAIKeyStatus,
  upsertOpenAIBaseUrl,
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
    return NextResponse.json({ error: "配置格式不合法" }, { status: 400 });
  }

  const saved = upsertOpenAIKey(parsed.data.apiKey);
  const baseUrl = parsed.data.baseUrl?.trim();

  if (baseUrl) {
    upsertOpenAIBaseUrl(baseUrl);
  }

  return NextResponse.json({
    configured: true,
    maskedKey: saved.maskedKey,
    baseUrl: baseUrl ?? getOpenAIKeyStatus().baseUrl,
    source: "database"
  });
}
```

- [ ] **Step 2: Test connectivity against the provided or saved Base URL**

```ts
// app/api/settings/openai-key/test/route.ts
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  getStoredOpenAIBaseUrl,
  getStoredOpenAIKey
} from "@/lib/services/runtime-config-service";
import { testOpenAIKeySchema } from "@/lib/validations/settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = testOpenAIKeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "配置格式不合法" }, { status: 400 });
  }

  const apiKey =
    parsed.data.apiKey?.trim() ||
    getStoredOpenAIKey()?.value ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";

  const baseURL =
    parsed.data.baseUrl?.trim() ||
    getStoredOpenAIBaseUrl()?.value ||
    process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "") ||
    undefined;

  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "当前没有可测试的 API Key" }, { status: 400 });
  }

  try {
    const client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {})
    });
    await client.models.list();
    return NextResponse.json({ ok: true, message: "连接成功" });
  } catch {
    return NextResponse.json({ ok: false, message: "连接失败，请检查 Key 或 Base URL" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Verify the API behavior**

Run: `Invoke-WebRequest -UseBasicParsing -Method Put -Uri http://localhost:3000/api/settings/openai-key -ContentType 'application/json' -Body '{"apiKey":"sk-test-1234567890abcd","baseUrl":"https://example.com/v1"}'`  
Expected: response includes `maskedKey`, `baseUrl`, and `source: "database"`

Run: `Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/settings/openai-key`  
Expected: response includes saved `baseUrl`

## Task 4: Update the settings page UI

**Files:**
- Modify: `components/settings/openai-key-settings.tsx`
- Test: manual browser verification

- [ ] **Step 1: Add current Base URL display and input field**

```tsx
// in components/settings/openai-key-settings.tsx
type KeyStatus = {
  configured: boolean;
  maskedKey: string;
  baseUrl: string;
  source: "database" | "env" | "default" | "none";
};

const [baseUrl, setBaseUrl] = useState("");

<p>当前 Base URL：{status?.baseUrl || "使用默认地址"}</p>

<label className="settings-field">
  <span>输入 Base URL</span>
  <input
    type="url"
    value={baseUrl}
    onChange={(event) => setBaseUrl(event.target.value)}
    placeholder="例如 https://your-gateway.example.com/v1"
  />
</label>
```

- [ ] **Step 2: Include Base URL when saving and testing**

```tsx
// save
body: JSON.stringify({
  apiKey,
  baseUrl: baseUrl.trim() || undefined
})

// test
body: JSON.stringify({
  ...(apiKey.trim() ? { apiKey } : {}),
  ...(baseUrl.trim() ? { baseUrl } : {})
})
```

- [ ] **Step 3: Clear only the API Key field after save**

```tsx
setApiKey("");
setBaseUrl("");
setStatus(data);
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`  
Expected:
- settings page shows current Base URL
- saving a new Base URL updates the status
- page refresh preserves the saved Base URL

## Task 5: Update docs and run final verification

**Files:**
- Modify: `README.md`
- Test: `npm run typecheck`, `npm run build`, manual API checks

- [ ] **Step 1: Update README**

```md
还支持网页设置全局 Base URL。

运行时读取顺序：
1. 数据库中的网页设置
2. `.env.local` 中的 `OPENAI_API_KEY` / `OPENAI_BASE_URL`
3. 对于 Base URL，如果仍未配置，则使用 OpenAI SDK 默认地址
```

- [ ] **Step 2: Run final verification**

Run: `npm run typecheck`  
Expected: no TypeScript errors

Run: `npm run build`  
Expected: build succeeds

Run: `Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/settings/openai-key` after saving Base URL  
Expected: response includes the saved Base URL and `source: "database"`

## Self-Review

Spec coverage check:

- Global Base URL setting: covered in Task 1 and Task 4
- Database-first resolution: covered in Task 1 and Task 2
- Environment fallback and SDK default: covered in Task 2 and Task 5
- Settings API payload expansion: covered in Task 3
- Shared settings page UX: covered in Task 4

Placeholder scan:

- No `TODO` or `TBD` placeholders remain
- All files are explicit
- Code steps are concrete
- Verification steps include commands and expected results

Type consistency check:

- `baseUrl` name is consistent across validation, service, API, and UI
- `openai_base_url` is the only config key used for Base URL storage
- `source` enum expansion includes `default` consistently
