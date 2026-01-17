/**
 * Gateway Connection State Store
 * Manages WebSocket connection state and messages
 */

import { create } from "zustand";
import type { EventFrame, HelloOkFrame } from "../lib/gateway/protocol";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

// Tool invocation types (AI SDK compatible)
export interface ToolInvocation {
  type: "tool-call" | "tool-result";
  toolCallId: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  state: "pending" | "partial" | "result";
  needsApproval?: boolean;
  approved?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolInvocations?: ToolInvocation[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GatewayState {
  // Connection state
  status: ConnectionStatus;
  error: string | null;
  serverInfo: HelloOkFrame["server"] | null;

  // Chat state
  messages: ChatMessage[];
  isGenerating: boolean;

  // Usage tracking
  usage: TokenUsage;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  setServerInfo: (info: HelloOkFrame["server"] | null) => void;
  connect: () => void;
  disconnect: () => void;

  // Message actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  appendToMessage: (id: string, delta: string) => void;
  addToolInvocation: (messageId: string, invocation: ToolInvocation) => void;
  updateToolInvocation: (
    messageId: string,
    toolCallId: string,
    updates: Partial<ToolInvocation>,
  ) => void;
  setIsGenerating: (generating: boolean) => void;
  clearMessages: () => void;

  // Usage actions
  updateUsage: (usage: Partial<TokenUsage>) => void;
  resetUsage: () => void;

  // Event handling
  handleEvent: (event: EventFrame) => void;
}

const DEFAULT_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
};

export const useGatewayStore = create<GatewayState>((set, get) => ({
  // Initial state
  status: "disconnected",
  error: null,
  serverInfo: null,
  messages: [],
  isGenerating: false,
  usage: { ...DEFAULT_USAGE },

  // Connection actions
  setStatus: (status) => set({ status }),

  setError: (error) =>
    set({
      error,
      status: error ? "error" : get().status,
    }),

  setServerInfo: (info) => set({ serverInfo: info }),

  connect: () => {
    set({ status: "connecting", error: null });
  },

  disconnect: () => {
    set({ status: "disconnected", error: null, serverInfo: null });
  },

  // Message actions
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg,
      ),
    })),

  appendToMessage: (id, delta) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + delta } : msg,
      ),
    })),

  addToolInvocation: (messageId, invocation) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolInvocations: [...(msg.toolInvocations ?? []), invocation],
            }
          : msg,
      ),
    })),

  updateToolInvocation: (messageId, toolCallId, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolInvocations: (msg.toolInvocations ?? []).map((inv) =>
                inv.toolCallId === toolCallId ? { ...inv, ...updates } : inv,
              ),
            }
          : msg,
      ),
    })),

  setIsGenerating: (generating) => set({ isGenerating: generating }),

  clearMessages: () => set({ messages: [] }),

  // Usage actions
  updateUsage: (usage) =>
    set((state) => {
      const newUsage = {
        inputTokens: usage.inputTokens ?? state.usage.inputTokens,
        outputTokens: usage.outputTokens ?? state.usage.outputTokens,
        totalTokens: 0,
      };
      newUsage.totalTokens = newUsage.inputTokens + newUsage.outputTokens;
      return { usage: newUsage };
    }),

  resetUsage: () => set({ usage: { ...DEFAULT_USAGE } }),

  // Event handling - maps gateway events to AI SDK message parts
  handleEvent: (event) => {
    const payload = event.payload as Record<string, unknown> | undefined;

    switch (event.event) {
      case "chat.delta": {
        const delta = payload?.delta as string | undefined;
        const messageId = payload?.messageId as string | undefined;
        if (delta && messageId) {
          get().appendToMessage(messageId, delta);
        }
        break;
      }

      case "chat.tool-use": {
        // Map to AI SDK tool-call part
        const messageId = payload?.messageId as string | undefined;
        const toolId = payload?.toolId as string | undefined;
        const toolName = payload?.toolName as string | undefined;
        const args = payload?.args;
        if (messageId && toolId && toolName) {
          get().addToolInvocation(messageId, {
            type: "tool-call",
            toolCallId: toolId,
            toolName,
            args,
            state: "pending",
          });
        }
        break;
      }

      case "chat.tool-result": {
        // Map to AI SDK tool-result part
        const messageId = payload?.messageId as string | undefined;
        const toolId = payload?.toolId as string | undefined;
        const result = payload?.result;
        const isError = payload?.isError as boolean | undefined;
        if (messageId && toolId) {
          get().updateToolInvocation(messageId, toolId, {
            type: "tool-result",
            result,
            isError,
            state: "result",
          });
        }
        break;
      }

      case "chat.complete": {
        const messageId = payload?.messageId as string | undefined;
        if (messageId) {
          get().updateMessage(messageId, { isStreaming: false });
          get().setIsGenerating(false);
        }
        break;
      }

      case "chat.start": {
        get().setIsGenerating(true);
        break;
      }

      case "chat.error": {
        const errorMsg = payload?.message as string | undefined;
        get().setError(errorMsg ?? "Chat error");
        get().setIsGenerating(false);
        break;
      }

      default:
        // Unknown event type, ignore
        break;
    }
  },
}));
