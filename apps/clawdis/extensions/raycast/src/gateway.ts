/**
 * Gateway Client for Raycast Extension
 * Simplified WebSocket client for Clawdbot Gateway
 */

import WebSocket from "ws";
import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  gatewayUrl: string;
  sessionKey?: string;
}

interface RequestFrame {
  type: "request";
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: "response";
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

let ws: WebSocket | null = null;
let pendingRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
let messageId = 0;

function generateId(): string {
  return `raycast-${Date.now()}-${++messageId}`;
}

export async function connect(): Promise<void> {
  const { gatewayUrl } = getPreferenceValues<Preferences>();

  if (ws?.readyState === WebSocket.OPEN) {
    return;
  }

  return new Promise((resolve, reject) => {
    ws = new WebSocket(gatewayUrl);

    ws.on("open", () => {
      resolve();
    });

    ws.on("message", (data) => {
      try {
        const frame = JSON.parse(data.toString()) as ResponseFrame;
        if (frame.type === "response" && frame.id) {
          const pending = pendingRequests.get(frame.id);
          if (pending) {
            pendingRequests.delete(frame.id);
            if (frame.error) {
              pending.reject(new Error(frame.error.message));
            } else {
              pending.resolve(frame.result);
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on("error", (err) => {
      reject(err);
    });

    ws.on("close", () => {
      ws = null;
    });
  });
}

export async function disconnect(): Promise<void> {
  if (ws) {
    ws.close();
    ws = null;
  }
}

export async function request<T>(method: string, params?: unknown): Promise<T> {
  await connect();

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected to gateway");
  }

  return new Promise((resolve, reject) => {
    const id = generateId();
    const frame: RequestFrame = {
      type: "request",
      id,
      method,
      params,
    };

    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });

    ws!.send(JSON.stringify(frame));

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("Request timeout"));
      }
    }, 30000);
  });
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function getSessionKey(): string {
  const { sessionKey } = getPreferenceValues<Preferences>();
  return sessionKey || "raycast";
}
