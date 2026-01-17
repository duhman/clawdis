/**
 * Gateway WebSocket Client for Clawdis
 * Connects to Clawdbot Gateway and handles protocol v3
 */

import {
  type ConnectParams,
  type EventFrame,
  type GatewayFrame,
  type HelloOkFrame,
  type ResponseFrame,
  GATEWAY_CLIENT_IDS,
  GATEWAY_CLIENT_MODES,
} from "./protocol";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

export type GatewayEventHandler = (event: EventFrame) => void;

export interface GatewayClientOptions {
  url: string;
  token?: string;
  password?: string;
  clientVersion?: string;
  instanceId?: string;
  autoReconnect?: boolean;
  maxRetries?: number;
  onHello?: (hello: HelloOkFrame) => void;
  onEvent?: GatewayEventHandler;
  onClose?: (info: { code: number; reason: string }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
  onReconnecting?: (attempt: number, delay: number) => void;
  onReconnectFailed?: () => void;
}

const CONNECT_FAILED_CLOSE_CODE = 4008;
const DEFAULT_URL = "ws://127.0.0.1:18789";
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const DEFAULT_MAX_RETRIES = 5;

function generateUUID(): string {
  return crypto.randomUUID();
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private retryCount = 0;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: GatewayClientOptions) {}

  get url(): string {
    return this.opts.url || DEFAULT_URL;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get currentRetryCount(): number {
    return this.retryCount;
  }

  get currentBackoffMs(): number {
    return this.backoffMs;
  }

  connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    this.clearReconnectTimer();
    this.closed = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      // Reset backoff on successful connection
      this.retryCount = 0;
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.sendConnect();
    };

    this.ws.onmessage = (ev) => {
      this.handleMessage(String(ev.data ?? ""));
    };

    this.ws.onclose = (ev) => {
      const reason = String(ev.reason ?? "");
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason });

      // Attempt reconnect if not deliberately closed
      if (!this.closed && this.opts.autoReconnect !== false) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Close handler will fire
    };
  }

  disconnect(): void {
    this.closed = true;
    this.clearReconnectTimer();
    // Flush pending first, before close triggers onclose
    this.flushPending(new Error("gateway client stopped"));
    this.ws?.close();
    this.ws = null;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;

    const maxRetries = this.opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (this.retryCount >= maxRetries) {
      this.opts.onReconnectFailed?.();
      return;
    }

    this.retryCount++;
    const delay = this.backoffMs;

    // Exponential backoff: double each time, cap at max
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);

    this.opts.onReconnecting?.(this.retryCount, delay);

    this.reconnectTimer = setTimeout(() => {
      if (!this.closed) {
        this.connect();
      }
    }, delay);
  }

  private flushPending(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private sendConnect(): void {
    const auth =
      this.opts.token || this.opts.password
        ? {
            token: this.opts.token,
            password: this.opts.password,
          }
        : undefined;

    const params: ConnectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: GATEWAY_CLIENT_IDS.CLAWDIS,
        version: this.opts.clientVersion ?? "0.1.0",
        platform: "macos",
        mode: GATEWAY_CLIENT_MODES.UI,
        instanceId: this.opts.instanceId,
      },
      caps: [],
      auth,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    this.request<HelloOkFrame>("connect", params)
      .then((hello) => {
        this.opts.onHello?.(hello);
      })
      .catch(() => {
        this.ws?.close(CONNECT_FAILED_CLOSE_CODE, "connect failed");
      });
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as GatewayFrame;

    if (frame.type === "event") {
      const evt = frame as EventFrame;
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }
      this.opts.onEvent?.(evt);
      return;
    }

    if (frame.type === "res") {
      const res = frame as ResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(new Error(res.error?.message ?? "request failed"));
      }
    }
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }

    const id = generateUUID();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }
}
