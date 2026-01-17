/**
 * Vercel AI SDK Integration for Clawdis
 * Provides custom transport and hooks for Gateway connection
 */

// Re-export types from AI SDK for convenience
export type { UIMessage, CreateUIMessage } from "@ai-sdk/react";

// Export useChat from AI SDK - will be wrapped with GatewayTransport
export { useChat as useAIChat } from "@ai-sdk/react";

// Gateway transport for bridging WebSocket to AI SDK
export { GatewayTransport } from "./gateway-transport";
export type {
  GatewayTransportOptions,
  GatewayTransportCallbacks,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  MessagePart,
} from "./gateway-transport";
