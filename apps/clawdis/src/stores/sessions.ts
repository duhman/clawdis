/**
 * Sessions Store
 * Manages chat sessions (conversations)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface SessionsState {
  sessions: Session[];
  activeSessionId: string;

  // Actions
  createSession: (name?: string) => string;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  deleteSession: (id: string) => void;
  getActiveSession: () => Session | undefined;
}

const generateId = () =>
  `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_SESSION_ID = "default";

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [
        {
          id: DEFAULT_SESSION_ID,
          name: "Default",
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
        },
      ],
      activeSessionId: DEFAULT_SESSION_ID,

      createSession: (name) => {
        const id = generateId();
        const session: Session = {
          id,
          name: name ?? `Chat ${get().sessions.length + 1}`,
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
        };

        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: id,
        }));

        return id;
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates, lastMessageAt: Date.now() } : s,
          ),
        }));
      },

      deleteSession: (id) => {
        const state = get();

        // Don't delete the last session
        if (state.sessions.length <= 1) return;

        // Don't delete the default session
        if (id === DEFAULT_SESSION_ID) return;

        const newSessions = state.sessions.filter((s) => s.id !== id);

        // If deleting active session, switch to first available
        const newActiveId =
          id === state.activeSessionId
            ? (newSessions[0]?.id ?? DEFAULT_SESSION_ID)
            : state.activeSessionId;

        set({
          sessions: newSessions,
          activeSessionId: newActiveId,
        });
      },

      getActiveSession: () => {
        const state = get();
        return state.sessions.find((s) => s.id === state.activeSessionId);
      },
    }),
    {
      name: "clawdis-sessions",
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    },
  ),
);
