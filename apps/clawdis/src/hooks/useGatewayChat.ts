/**
 * useGatewayChat Hook
 *
 * React hook that wraps GatewayTransport for AI SDK-like chat interface.
 * Provides streaming text, tool calls, and message management.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  GatewayTransport,
  type GatewayTransportCallbacks,
  type ToolCallPart,
  type ToolResultPart,
} from "../lib/ai";
import { GatewayClient } from "../lib/gateway/client";
import type { EventFrame } from "../lib/gateway/protocol";

// Message types for chat history
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallPart[];
  toolResults?: ToolResultPart[];
  createdAt: Date;
}

// Options for the hook
export interface UseGatewayChatOptions {
  client: GatewayClient;
  sessionKey?: string;
  thinking?: "none" | "low" | "medium" | "high" | "max";
  initialMessages?: ChatMessage[];
  onError?: (error: Error) => void;
}

// Return type for the hook
export interface UseGatewayChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content?: string) => Promise<void>;
  append: (message: Omit<ChatMessage, "id" | "createdAt">) => void;
  reload: () => Promise<void>;
  stop: () => Promise<void>;
  setMessages: (messages: ChatMessage[]) => void;
}

/**
 * Custom hook for chat with Gateway transport
 */
export function useGatewayChat(
  options: UseGatewayChatOptions,
): UseGatewayChatReturn {
  const {
    client,
    sessionKey,
    thinking = "low",
    initialMessages = [],
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Transport ref to maintain across renders
  const transportRef = useRef<GatewayTransport | null>(null);

  // Current assistant message being streamed
  const streamingMessageRef = useRef<ChatMessage | null>(null);

  // Initialize transport
  useEffect(() => {
    transportRef.current = new GatewayTransport({
      client,
      sessionKey,
      thinking,
    });

    return () => {
      transportRef.current?.stopListening();
    };
  }, [client, sessionKey, thinking]);

  // Update transport settings when they change
  useEffect(() => {
    if (transportRef.current) {
      transportRef.current.setSessionKey(sessionKey);
      transportRef.current.setThinking(thinking);
    }
  }, [sessionKey, thinking]);

  // Handle gateway events
  const handleEvent = useCallback((event: EventFrame) => {
    if (!transportRef.current?.isListening) return;
    transportRef.current.handleEvent(event);
  }, []);

  // Setup transport callbacks
  useEffect(() => {
    if (!transportRef.current) return;

    const callbacks: GatewayTransportCallbacks = {
      onTextDelta: (delta) => {
        if (streamingMessageRef.current) {
          streamingMessageRef.current.content += delta;
          // Trigger re-render with updated message
          setMessages((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex(
              (m) => m.id === streamingMessageRef.current?.id,
            );
            if (idx >= 0) {
              updated[idx] = { ...streamingMessageRef.current! };
            }
            return updated;
          });
        }
      },

      onToolCall: (toolCall) => {
        if (streamingMessageRef.current) {
          const calls = streamingMessageRef.current.toolCalls ?? [];
          calls.push(toolCall);
          streamingMessageRef.current.toolCalls = calls;
          setMessages((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex(
              (m) => m.id === streamingMessageRef.current?.id,
            );
            if (idx >= 0) {
              updated[idx] = { ...streamingMessageRef.current! };
            }
            return updated;
          });
        }
      },

      onToolResult: (result) => {
        if (streamingMessageRef.current) {
          const results = streamingMessageRef.current.toolResults ?? [];
          results.push(result);
          streamingMessageRef.current.toolResults = results;
          setMessages((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex(
              (m) => m.id === streamingMessageRef.current?.id,
            );
            if (idx >= 0) {
              updated[idx] = { ...streamingMessageRef.current! };
            }
            return updated;
          });
        }
      },

      onComplete: () => {
        streamingMessageRef.current = null;
        setIsLoading(false);
      },

      onError: (err) => {
        setError(err);
        setIsLoading(false);
        streamingMessageRef.current = null;
        options.onError?.(err);
      },
    };

    transportRef.current.setCallbacks(callbacks);
  }, [options]);

  // Expose handleEvent for external gateway event routing
  useEffect(() => {
    // Store handleEvent on transport for external access
    (
      transportRef.current as unknown as {
        externalHandler?: typeof handleEvent;
      }
    ).externalHandler = handleEvent;
  }, [handleEvent]);

  // Send a message
  const sendMessage = useCallback(
    async (content?: string) => {
      const messageContent = content ?? input;
      if (!messageContent.trim() || !transportRef.current) return;

      setError(null);
      setIsLoading(true);

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageContent,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      // Create streaming assistant message
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      streamingMessageRef.current = assistantMessage;
      setMessages((prev) => [...prev, assistantMessage]);

      // Start listening and send
      transportRef.current.startListening();

      try {
        await transportRef.current.sendMessage(messageContent);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        streamingMessageRef.current = null;
        transportRef.current.stopListening();
      }
    },
    [input],
  );

  // Append a message manually
  const append = useCallback(
    (message: Omit<ChatMessage, "id" | "createdAt">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    [],
  );

  // Reload/regenerate last message
  const reload = useCallback(async () => {
    // Find last user message
    const lastUserIdx = [...messages]
      .reverse()
      .findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;

    const realIdx = messages.length - 1 - lastUserIdx;
    const lastUserMessage = messages[realIdx];

    // Remove messages from last user message onwards
    setMessages((prev) => prev.slice(0, realIdx));

    // Resend
    await sendMessage(lastUserMessage.content);
  }, [messages, sendMessage]);

  // Stop generation
  const stop = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.abort();
      transportRef.current.stopListening();
    }
    setIsLoading(false);
    streamingMessageRef.current = null;
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    sendMessage,
    append,
    reload,
    stop,
    setMessages,
  };
}
