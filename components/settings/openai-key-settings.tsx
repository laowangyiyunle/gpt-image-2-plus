"use client";

import { useEffect, useState } from "react";

type KeyStatus = {
  configured: boolean;
  maskedKey: string;
  baseUrl: string;
  source: "database" | "env" | "default";
};

type StorageStats = {
  storedFiles: number;
  referencedFiles: number;
  orphanFiles: number;
  removedFiles?: number;
};

const SOURCE_LABEL: Record<KeyStatus["source"], string> = {
  database: "数据库",
  env: "环境变量",
  default: "默认"
};

type OpenAIKeySettingsProps = {
  onStatusLoaded?: (status: KeyStatus) => void;
  onStorageCleared?: () => void;
};

export function OpenAIKeySettings({
  onStatusLoaded,
  onStorageCleared
}: OpenAIKeySettingsProps) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  async function loadStatus() {
    const response = await fetch("/api/settings/openai-key");
    const data = (await response.json()) as KeyStatus;
    setStatus(data);
    onStatusLoaded?.(data);
  }

  async function loadStorageStats() {
    const response = await fetch("/api/storage/cleanup");
    const data = (await response.json()) as StorageStats;
    setStorageStats(data);
  }

  useEffect(() => {
    void loadStatus();
    void loadStorageStats();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/openai-key", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...(apiKey.trim() ? { apiKey } : {}),
          ...(baseUrl.trim() ? { baseUrl } : {})
        })
      });

      const data = (await response.json()) as KeyStatus & { error?: string };

      if (!response.ok) {
        setMessage(data.error || "保存失败");
        return;
      }

      setStatus(data);
      onStatusLoaded?.(data);
      setApiKey("");
      setBaseUrl("");
      setMessage("保存成功");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings/openai-key/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...(apiKey.trim() ? { apiKey } : {}),
          ...(baseUrl.trim() ? { baseUrl } : {})
        })
      });

      const data = (await response.json()) as { message?: string };
      setMessage(data.message || "测试完成");
    } finally {
      setTesting(false);
    }
  }

  async function handleCleanup(mode: "orphans" | "all") {
    if (mode === "all" && !window.confirm("确定要清空全部历史和本地图片吗？")) {
      return;
    }

    setCleaning(true);
    setMessage("");

    try {
      const response = await fetch("/api/storage/cleanup", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode })
      });
      const data = (await response.json()) as StorageStats;

      setStorageStats(data);
      setMessage(
        mode === "all"
          ? "已清空全部历史和本地图片"
          : `已清理 ${data.removedFiles ?? 0} 个未引用文件`
      );

      if (mode === "all") {
        onStorageCleared?.();
      }
    } finally {
      setCleaning(false);
    }
  }

  return (
    <section className="settings-panel">
      <div className="settings-card">
        <h2>OpenAI API Key</h2>
        <p>当前状态：{status?.configured ? "已配置" : "未配置"}</p>
        <p>当前来源：{status ? SOURCE_LABEL[status.source] : "加载中"}</p>
        <p>当前 Key：{status?.maskedKey || "未配置"}</p>
        <p>当前 Base URL：{status?.baseUrl || "使用默认地址"}</p>

        <label className="settings-field">
          <span>输入新的 API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="输入新的 OpenAI API Key"
          />
        </label>

        <label className="settings-field">
          <span>输入 Base URL</span>
          <input
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="例如 https://your-gateway.example.com/v1"
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || (!apiKey.trim() && !baseUrl.trim())}
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
          >
            {testing ? "测试中..." : "测试连接"}
          </button>
        </div>

        <div className="settings-divider" />

        <h2>本地存储</h2>
        <p>本地图片：{storageStats?.storedFiles ?? 0} 个</p>
        <p>历史引用：{storageStats?.referencedFiles ?? 0} 个</p>
        <p>可清理文件：{storageStats?.orphanFiles ?? 0} 个</p>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => void handleCleanup("orphans")}
            disabled={cleaning}
          >
            清理无用图片
          </button>
          <button
            type="button"
            className="danger-action"
            onClick={() => void handleCleanup("all")}
            disabled={cleaning}
          >
            清空历史和图片
          </button>
        </div>

        {message ? <p className="settings-message">{message}</p> : null}
      </div>
    </section>
  );
}
