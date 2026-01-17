/**
 * Session Item Component
 * Individual session row in the session list
 */

import { useCallback } from "react";
import type { Session } from "../../stores/sessions";

export interface SessionItemProps {
  session: Session;
  isActive: boolean;
  shortcut?: string;
  onSelect: (session: Session) => void;
  onDelete?: (session: Session) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function SessionItem({
  session,
  isActive,
  shortcut,
  onSelect,
  onDelete,
}: SessionItemProps) {
  const handleClick = useCallback(() => {
    onSelect(session);
  }, [session, onSelect]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(session);
    },
    [session, onDelete],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(session);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete?.(session);
      }
    },
    [session, onSelect, onDelete],
  );

  const totalTokens = session.inputTokens + session.outputTokens;

  return (
    <div
      className={`session-item ${isActive ? "active" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-selected={isActive}
    >
      <div className="session-item-content">
        <div className="session-item-header">
          <span className="session-item-name">{session.name}</span>
          {shortcut && (
            <span className="session-item-shortcut">{shortcut}</span>
          )}
        </div>
        <div className="session-item-meta">
          <span className="session-item-time">
            {formatRelativeTime(session.lastMessageAt)}
          </span>
          {session.messageCount > 0 && (
            <span className="session-item-count">
              {session.messageCount} msgs
            </span>
          )}
          {totalTokens > 0 && (
            <span className="session-item-tokens">
              {formatTokens(totalTokens)} tokens
            </span>
          )}
        </div>
      </div>

      {onDelete && (
        <button
          className="session-item-delete"
          onClick={handleDelete}
          aria-label={`Delete ${session.name}`}
        >
          &times;
        </button>
      )}
    </div>
  );
}
