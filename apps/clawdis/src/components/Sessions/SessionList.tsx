/**
 * Session List Component
 * Sidebar showing all sessions with quick switching
 */

import { useCallback, useEffect } from "react";
import { useSessionsStore, type Session } from "../../stores/sessions";
import { SessionItem } from "./SessionItem";
import "./SessionList.css";

export interface SessionListProps {
  onSessionChange?: (sessionId: string) => void;
}

export function SessionList({ onSessionChange }: SessionListProps) {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSession = useSessionsStore((s) => s.setActiveSession);
  const createSession = useSessionsStore((s) => s.createSession);
  const deleteSession = useSessionsStore((s) => s.deleteSession);

  const handleSelectSession = useCallback(
    (session: Session) => {
      setActiveSession(session.id);
      onSessionChange?.(session.id);
    },
    [setActiveSession, onSessionChange],
  );

  const handleNewSession = useCallback(() => {
    const id = createSession();
    onSessionChange?.(id);
  }, [createSession, onSessionChange]);

  const handleDeleteSession = useCallback(
    (session: Session) => {
      deleteSession(session.id);
    },
    [deleteSession],
  );

  // Keyboard shortcuts: Cmd+1-9 for quick session switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (index < sessions.length) {
          e.preventDefault();
          const session = sessions[index];
          setActiveSession(session.id);
          onSessionChange?.(session.id);
        }
      }

      // Cmd+N for new session
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewSession();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessions, setActiveSession, onSessionChange, handleNewSession]);

  return (
    <aside className="session-list">
      <header className="session-list-header">
        <h3>Sessions</h3>
        <button
          className="session-list-new"
          onClick={handleNewSession}
          title="New session (Cmd+N)"
        >
          +
        </button>
      </header>

      <div className="session-list-items">
        {sessions.map((session, index) => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            shortcut={index < 9 ? `⌘${index + 1}` : undefined}
            onSelect={handleSelectSession}
            onDelete={
              session.id !== "default" ? handleDeleteSession : undefined
            }
          />
        ))}
      </div>
    </aside>
  );
}
