/**
 * Gateway Protocol Types for Clawdis
 * Based on src/gateway/protocol/schema/frames.ts
 */

// Client identifiers
export const GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: "webchat-ui",
  CONTROL_UI: "clawdbot-control-ui",
  WEBCHAT: "webchat",
  CLI: "cli",
  GATEWAY_CLIENT: "gateway-client",
  MACOS_APP: "clawdbot-macos",
  CLAWDIS: "clawdis",
  TEST: "test",
  FINGERPRINT: "fingerprint",
  PROBE: "clawdbot-probe",
} as const;

export type GatewayClientId =
  (typeof GATEWAY_CLIENT_IDS)[keyof typeof GATEWAY_CLIENT_IDS];

// Client modes
export const GATEWAY_CLIENT_MODES = {
  WEBCHAT: "webchat",
  CLI: "cli",
  UI: "ui",
  BACKEND: "backend",
  PROBE: "probe",
  TEST: "test",
} as const;

export type GatewayClientMode =
  (typeof GATEWAY_CLIENT_MODES)[keyof typeof GATEWAY_CLIENT_MODES];

// Client info for connection
export interface GatewayClientInfo {
  id: GatewayClientId;
  displayName?: string;
  version: string;
  platform: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode: GatewayClientMode;
  instanceId?: string;
}

// Connection parameters
export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: GatewayClientInfo;
  caps?: string[];
  auth?: {
    token?: string;
    password?: string;
  };
  locale?: string;
  userAgent?: string;
}

// State version tracking
export interface StateVersion {
  presence: number;
  health: number;
}

// Server info from hello response
export interface ServerInfo {
  version: string;
  commit?: string;
  host?: string;
  connId: string;
}

// Feature capabilities
export interface ServerFeatures {
  methods: string[];
  events: string[];
}

// Policy constraints
export interface ServerPolicy {
  maxPayload: number;
  maxBufferedBytes: number;
  tickIntervalMs: number;
}

// Hello OK response
export interface HelloOkFrame {
  type: "hello-ok";
  protocol: number;
  server: ServerInfo;
  features: ServerFeatures;
  snapshot?: unknown;
  canvasHostUrl?: string;
  policy: ServerPolicy;
}

// Error shape
export interface ErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

// Request frame (client → server)
export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

// Response frame (server → client)
export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
}

// Event frame (server → client, push)
export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: StateVersion;
}

// Union of all frame types
export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

// Tick event payload
export interface TickEventPayload {
  ts: number;
}

// Shutdown event payload
export interface ShutdownEventPayload {
  reason: string;
  restartExpectedMs?: number;
}

// Chat event types
export interface ChatDeltaPayload {
  sessionKey: string;
  delta: string;
  messageId?: string;
}

export interface ChatToolUsePayload {
  sessionKey: string;
  toolName: string;
  toolId: string;
  args: unknown;
}

export interface ChatToolResultPayload {
  sessionKey: string;
  toolId: string;
  result: unknown;
  isError?: boolean;
}

export interface ChatCompletePayload {
  sessionKey: string;
  messageId: string;
  content: string;
  role: "assistant";
}

// Chat request params
export interface ChatSendParams {
  sessionKey?: string;
  message: string;
  thinking?: "none" | "low" | "medium" | "high" | "max";
}

export interface ChatHistoryParams {
  sessionKey?: string;
  limit?: number;
  before?: string;
}

export interface ChatAbortParams {
  sessionKey?: string;
}

export interface ToolApprovalParams {
  sessionKey?: string;
  toolCallId: string;
  approved: boolean;
  reason?: string;
}
