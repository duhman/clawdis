/**
 * Gateway Transport for Vercel AI SDK
 *
 * Bridges the GatewayClient WebSocket connection to the AI SDK's chat interface.
 * Converts gateway events to AI SDK message parts for streaming.
 */

import type { GatewayClient } from "../gateway/client";
import type {
  ChatDeltaPayload,
  ChatToolUsePayload,
  ChatToolResultPayload,
  ChatCompletePayload,
  EventFrame,
} from "../gateway/protocol";

// AI SDK compatible message part types
export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}

export type MessagePart = TextPart | ToolCallPart | ToolResultPart;

// Callback types for transport events
export interface GatewayTransportCallbacks {
  onTextDelta?: (delta: string) => void;
  onToolCall?: (toolCall: ToolCallPart) => void;
  onToolResult?: (result: ToolResultPart) => void;
  onComplete?: (message: { id: string; content: string }) => void;
  onError?: (error: Error) => void;
}

// Transport options
export interface GatewayTransportOptions {
  client: GatewayClient;
  sessionKey?: string;
  thinking?: "none" | "low" | "medium" | "high" | "max";
}

/**
 * GatewayTransport wraps a GatewayClient to provide AI SDK-compatible
 * streaming chat functionality via WebSocket events.
 */
export class GatewayTransport {
  private client: GatewayClient;
  private sessionKey: string | undefined;
  private thinking: "none" | "low" | "medium" | "high" | "max";
  private callbacks: GatewayTransportCallbacks = {};
  private listening = false;

  constructor(options: GatewayTransportOptions) {
    this.client = options.client;
    this.sessionKey = options.sessionKey;
    this.thinking = options.thinking ?? "low";
  }

  /**
   * Check if transport is currently listening for events
   */
  get isListening(): boolean {
    return this.listening;
  }

  /**
   * Set the session key for chat context
   */
  setSessionKey(key: string | undefined): void {
    this.sessionKey = key;
  }

  /**
   * Set the thinking level for responses
   */
  setThinking(level: "none" | "low" | "medium" | "high" | "max"): void {
    this.thinking = level;
  }

  /**
   * Register callbacks for transport events
   */
  setCallbacks(callbacks: GatewayTransportCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Start listening for gateway events
   */
  startListening(): void {
    this.listening = true;
  }

  /**
   * Stop listening for gateway events
   */
  stopListening(): void {
    this.listening = false;
  }

  /**
   * Handle incoming gateway event and route to appropriate callback
   */
  handleEvent(event: EventFrame): void {
    switch (event.event) {
      case "chat.delta": {
        const payload = event.payload as ChatDeltaPayload;
        if (this.matchesSession(payload.sessionKey)) {
          this.callbacks.onTextDelta?.(payload.delta);
        }
        break;
      }

      case "chat.tool-use": {
        const payload = event.payload as ChatToolUsePayload;
        if (this.matchesSession(payload.sessionKey)) {
          this.callbacks.onToolCall?.({
            type: "tool-call",
            toolCallId: payload.toolId,
            toolName: payload.toolName,
            args: payload.args,
          });
        }
        break;
      }

      case "chat.tool-result": {
        const payload = event.payload as ChatToolResultPayload;
        if (this.matchesSession(payload.sessionKey)) {
          this.callbacks.onToolResult?.({
            type: "tool-result",
            toolCallId: payload.toolId,
            result: payload.result,
            isError: payload.isError,
          });
        }
        break;
      }

      case "chat.complete": {
        const payload = event.payload as ChatCompletePayload;
        if (this.matchesSession(payload.sessionKey)) {
          this.callbacks.onComplete?.({
            id: payload.messageId,
            content: payload.content,
          });
        }
        break;
      }

      case "chat.error": {
        const payload = event.payload as { sessionKey?: string; error: string };
        if (this.matchesSession(payload.sessionKey)) {
          this.callbacks.onError?.(new Error(payload.error));
        }
        break;
      }
    }
  }

  /**
   * Send a chat message through the gateway
   */
  async sendMessage(content: string): Promise<void> {
    if (!this.client.connected) {
      throw new Error("Gateway not connected");
    }

    await this.client.request("chat.send", {
      message: content,
      sessionKey: this.sessionKey,
      thinking: this.thinking,
    });
  }

  /**
   * Abort the current chat generation
   */
  async abort(): Promise<void> {
    if (!this.client.connected) {
      return;
    }

    await this.client.request("chat.abort", {
      sessionKey: this.sessionKey,
    });
  }

  /**
   * Send a tool approval response to the gateway
   */
  async addToolApprovalResponse(
    toolCallId: string,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    if (!this.client.connected) {
      throw new Error("Gateway not connected");
    }

    await this.client.request("tool.approve", {
      sessionKey: this.sessionKey,
      toolCallId,
      approved,
      reason,
    });
  }

  /**
   * Check if a session key matches our tracked session
   */
  private matchesSession(eventSessionKey?: string): boolean {
    // If no session key is set, accept all events
    if (!this.sessionKey) return true;
    // Otherwise, match the session key
    return eventSessionKey === this.sessionKey;
  }
}
