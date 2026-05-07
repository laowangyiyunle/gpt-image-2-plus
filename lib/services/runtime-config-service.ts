import { nowIso } from "@/lib/db/helpers";
import { getDb } from "@/lib/db/sqlite";

const OPENAI_KEY_NAME = "openai_api_key";
const OPENAI_BASE_URL_NAME = "openai_base_url";

function getConfigValue(key: string) {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT value, updated_at
        FROM runtime_config
        WHERE key = ?
      `
    )
    .get(key) as
    | {
        value: string;
        updated_at: string;
      }
    | undefined;

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

  db.prepare(
    `
      INSERT INTO runtime_config (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `
  ).run(key, value, updatedAt);

  return updatedAt;
}

function maskOpenAIKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= 8) {
    return "已配置";
  }

  if (trimmed.startsWith("sk-")) {
    return `sk-****${trimmed.slice(-4)}`;
  }

  return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`;
}

export function getStoredOpenAIKey() {
  const row = getConfigValue(OPENAI_KEY_NAME);

  if (!row) {
    return null;
  }

  return {
    value: row.value,
    updatedAt: row.updatedAt,
    maskedKey: maskOpenAIKey(row.value)
  };
}

export function upsertOpenAIKey(apiKey: string) {
  const trimmed = apiKey.trim();
  const updatedAt = upsertConfigValue(OPENAI_KEY_NAME, trimmed);

  return {
    updatedAt,
    maskedKey: maskOpenAIKey(trimmed)
  };
}

export function getStoredOpenAIBaseUrl() {
  return getConfigValue(OPENAI_BASE_URL_NAME);
}

export function upsertOpenAIBaseUrl(baseUrl: string) {
  return upsertConfigValue(
    OPENAI_BASE_URL_NAME,
    baseUrl.trim().replace(/\/+$/, "")
  );
}

export function getOpenAIKeyStatus() {
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
}
