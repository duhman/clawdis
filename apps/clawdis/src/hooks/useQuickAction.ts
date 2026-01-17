/**
 * useQuickAction Hook
 * Send messages to gateway without opening full UI
 */

import { useState, useCallback } from "react";
import type { GatewayClient } from "../lib/gateway/client";

export interface UseQuickActionOptions {
  client: GatewayClient | null;
  sessionKey?: string;
  thinking?: "none" | "low" | "medium" | "high" | "max";
  onSuccess?: (response: string) => void;
  onError?: (error: string) => void;
}

export interface UseQuickActionReturn {
  send: (message: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  lastResponse: string | null;
}

/**
 * Hook for sending quick messages to the gateway
 */
export function useQuickAction(
  options: UseQuickActionOptions,
): UseQuickActionReturn {
  const { client, sessionKey, thinking = "low", onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const send = useCallback(
    async (message: string) => {
      if (!client?.connected) {
        const err = "Not connected to gateway";
        setError(err);
        onError?.(err);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Send message and wait for response
        const response = await client.request<{ content: string }>(
          "chat.send",
          {
            message,
            sessionKey,
            thinking,
            stream: false, // Non-streaming for quick actions
          },
        );

        setLastResponse(response.content);
        onSuccess?.(response.content);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send";
        setError(message);
        onError?.(message);
      } finally {
        setIsLoading(false);
      }
    },
    [client, sessionKey, thinking, onSuccess, onError],
  );

  return {
    send,
    isLoading,
    error,
    lastResponse,
  };
}

/**
 * Quick action presets
 */
export const QUICK_ACTIONS = {
  SUMMARIZE: "Summarize the last message",
  EXPLAIN: "Explain this in simpler terms",
  EXPAND: "Expand on this idea",
  TRANSLATE: "Translate to English",
  FIX_GRAMMAR: "Fix grammar and spelling",
} as const;
