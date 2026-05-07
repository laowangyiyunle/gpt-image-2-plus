import type { ChatSession } from "@/lib/types/chat";

type SessionSidebarProps = {
  sessions: ChatSession[];
  activeSessionId: string | null;
  disabled?: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDelete: (sessionId: string) => void;
  onOpenSettings: () => void;
};

export function SessionSidebar({
  sessions,
  activeSessionId,
  disabled = false,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings
}: SessionSidebarProps) {
  return (
    <aside className="session-sidebar">
      <div className="session-sidebar-header">
        <div>
          <h1>图片对话</h1>
          <p>本地历史会话</p>
        </div>
        <button type="button" onClick={onCreate} disabled={disabled}>
          新建会话
        </button>
      </div>

      <div className="session-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${
              activeSessionId === session.id ? "session-item-active" : ""
            }`}
          >
            <button
              type="button"
              className="session-item-main"
              disabled={disabled}
              onClick={() => onSelect(session.id)}
            >
              <span className="session-title">{session.title}</span>
              <span className="session-date">
                {new Date(session.updatedAt).toLocaleString("zh-CN")}
              </span>
            </button>

            <button
              type="button"
              className="session-delete-button"
              aria-label={`删除会话 ${session.title}`}
              disabled={disabled}
              onClick={() => onDelete(session.id)}
            >
              删除
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-settings-button" onClick={onOpenSettings}>
          设置
        </button>
      </div>
    </aside>
  );
}
