/**
 * useGateway Hook
 * Manages Gateway connection lifecycle and event handling
 */

import { useEffect, useRef, useCallback } from "react";
import {
  GatewayClient,
  type GatewayClientOptions,
} from "../lib/gateway/client";
import { useGatewayStore, type ChatMessage } from "../stores/gateway";
import type { EventFrame, HelloOkFrame } from "../lib/gateway/protocol";

const DEFAULT_URL = "ws://127.0.0.1:18789";

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "max";

interface UseGatewayOptions {
  url?: string;
  token?: string;
  password?: string;
  sessionKey?: string;
  autoConnect?: boolean;
  loadHistory?: boolean;
  thinking?: ThinkingLevel;
}

interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface HistoryResponse {
  messages: HistoryMessage[];
  hasMore: boolean;
}

export function useGateway(options: UseGatewayOptions = {}) {
  const {
    url = DEFAULT_URL,
    token,
    password,
    sessionKey,
    autoConnect = true,
    loadHistory = true,
    thinking = "low",
  } = options;

  const clientRef = useRef<GatewayClient | null>(null);
  const sessionKeyRef = useRef(sessionKey);
  const setStatus = useGatewayStore((s) => s.setStatus);
  const setError = useGatewayStore((s) => s.setError);
  const setServerInfo = useGatewayStore((s) => s.setServerInfo);
  const handleEvent = useGatewayStore((s) => s.handleEvent);
  const addMessage = useGatewayStore((s) => s.addMessage);
  const setIsGenerating = useGatewayStore((s) => s.setIsGenerating);
  const clearMessages = useGatewayStore((s) => s.clearMessages);
  const status = useGatewayStore((s) => s.status);

  // Keep sessionKey ref updated
  useEffect(() => {
    sessionKeyRef.current = sessionKey;
  }, [sessionKey]);

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    if (!clientRef.current || !loadHistory) return;

    try {
      const response = await clientRef.current.request<HistoryResponse>(
        "chat.history",
        {
          sessionKey: sessionKeyRef.current,
          limit: 50,
        },
      );

      // Clear existing messages and load history
      clearMessages();
      for (const msg of response.messages) {
        addMessage({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp ?? Date.now(),
        });
      }
    } catch {
      // History load is optional, don't show error
    }
  }, [loadHistory, clearMessages, addMessage]);

  // Create client on mount
  useEffect(() => {
    const onHello = (hello: HelloOkFrame) => {
      setStatus("connected");
      setServerInfo(hello.server);
      // Load history after connection
      loadChatHistory();
    };

    const onEvent = (event: EventFrame) => {
      handleEvent(event);
    };

    const onClose = ({ code, reason }: { code: number; reason: string }) => {
      setStatus("disconnected");
      if (code !== 1000) {
        setError(`Connection closed: ${reason || code}`);
      }
    };

    const clientOpts: GatewayClientOptions = {
      url,
      token,
      password,
      onHello,
      onEvent,
      onClose,
    };

    clientRef.current = new GatewayClient(clientOpts);

    if (autoConnect) {
      setStatus("connecting");
      clientRef.current.connect();
    }

    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [
    url,
    token,
    password,
    autoConnect,
    setStatus,
    setError,
    setServerInfo,
    handleEvent,
    loadChatHistory,
  ]);

  // Connect function
  const connect = useCallback(() => {
    if (clientRef.current && status !== "connected") {
      setStatus("connecting");
      clientRef.current.connect();
    }
  }, [status, setStatus]);

  // Disconnect function
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    setStatus("disconnected");
  }, [setStatus]);

  // Send chat message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!clientRef.current || status !== "connected") {
        setError("Not connected to gateway");
        return;
      }

      // Add user message to store
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      };
      addMessage(userMessage);

      // Create placeholder for assistant response
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      addMessage(assistantMessage);
      setIsGenerating(true);

      try {
        await clientRef.current.request("chat.send", {
          message: content,
          sessionKey: sessionKeyRef.current,
          thinking,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send";
        setError(message);
        setIsGenerating(false);
      }
    },
    [status, setError, addMessage, setIsGenerating],
  );

  // Abort current generation
  const abort = useCallback(async () => {
    if (!clientRef.current || status !== "connected") return;

    try {
      await clientRef.current.request("chat.abort", {
        sessionKey: sessionKeyRef.current,
      });
    } catch {
      // Ignore abort errors
    }
  }, [status]);

  // Send tool approval response
  const updateToolInvocation = useGatewayStore((s) => s.updateToolInvocation);

  const approveToolCall = useCallback(
    async (messageId: string, toolCallId: string) => {
      if (!clientRef.current || status !== "connected") return;

      try {
        await clientRef.current.request("tool.approve", {
          sessionKey: sessionKeyRef.current,
          toolCallId,
          approved: true,
        });
        updateToolInvocation(messageId, toolCallId, { approved: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Approval failed";
        setError(message);
      }
    },
    [status, setError, updateToolInvocation],
  );

  const rejectToolCall = useCallback(
    async (messageId: string, toolCallId: string, reason?: string) => {
      if (!clientRef.current || status !== "connected") return;

      try {
        await clientRef.current.request("tool.approve", {
          sessionKey: sessionKeyRef.current,
          toolCallId,
          approved: false,
          reason,
        });
        updateToolInvocation(messageId, toolCallId, { approved: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Rejection failed";
        setError(message);
      }
    },
    [status, setError, updateToolInvocation],
  );

  return {
    connect,
    disconnect,
    sendMessage,
    abort,
    approveToolCall,
    rejectToolCall,
    loadHistory: loadChatHistory,
    client: clientRef.current,
  };
}
