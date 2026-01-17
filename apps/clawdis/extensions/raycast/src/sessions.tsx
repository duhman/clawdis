import {
  Action,
  ActionPanel,
  List,
  showToast,
  Toast,
  Icon,
} from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import { request } from "./gateway";

interface Session {
  key: string;
  title: string;
  messageCount: number;
  lastActivity: number;
}

interface SessionsResponse {
  sessions: Session[];
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await request<SessionsResponse>("session.list", {});
      setSessions(response.sessions || []);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const selectSession = useCallback(async (sessionKey: string) => {
    setSelectedSession(sessionKey);
    showToast({
      style: Toast.Style.Success,
      title: "Session selected",
      message: `Now using session: ${sessionKey}`,
    });
  }, []);

  const deleteSession = useCallback(
    async (sessionKey: string) => {
      try {
        await request("session.delete", { sessionKey });
        showToast({
          style: Toast.Style.Success,
          title: "Session deleted",
        });
        loadSessions();
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to delete session",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [loadSessions],
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <List isLoading={isLoading}>
      {sessions.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No sessions found"
          description="Start a conversation to create a session"
        />
      ) : (
        sessions.map((session) => (
          <List.Item
            key={session.key}
            title={session.title || session.key}
            subtitle={`${session.messageCount} messages`}
            accessories={[
              { text: formatDate(session.lastActivity) },
              ...(selectedSession === session.key
                ? [{ icon: Icon.Checkmark }]
                : []),
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Select Session"
                  icon={Icon.CheckCircle}
                  onAction={() => selectSession(session.key)}
                />
                <Action
                  title="Delete Session"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => deleteSession(session.key)}
                />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={loadSessions}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
