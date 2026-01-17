import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayClient } from "./client";

// Store the created mock for test assertions
let createdMocks: MockWebSocket[] = [];
let mockShouldAutoOpen = true;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(public url: string) {
    createdMocks.push(this);
    if (mockShouldAutoOpen) {
      setTimeout(() => {
        if (this.readyState === MockWebSocket.CONNECTING) {
          this.readyState = MockWebSocket.OPEN;
          this.onopen?.();
        }
      }, 0);
    }
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? "" });
  }

  // Helper to simulate incoming message
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  // Helper to simulate connection failure
  simulateError() {
    this.onerror?.();
    this.close(1006, "connection failed");
  }
}

describe("GatewayClient", () => {
  let originalWebSocket: typeof globalThis.WebSocket | undefined;

  beforeEach(() => {
    createdMocks = [];
    mockShouldAutoOpen = true;
    originalWebSocket = globalThis.WebSocket;
    // Use class as mock
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    if (originalWebSocket) {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  function getLatestMock(): MockWebSocket {
    return createdMocks[createdMocks.length - 1];
  }

  it("should create a client with default URL", () => {
    const client = new GatewayClient({ url: "ws://localhost:18789" });
    expect(client.url).toBe("ws://localhost:18789");
  });

  it("should report connected status correctly", async () => {
    const client = new GatewayClient({ url: "ws://localhost:18789" });
    expect(client.connected).toBe(false);

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    expect(client.connected).toBe(true);
  });

  it("should send connect request on WebSocket open", async () => {
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      clientVersion: "1.0.0",
    });

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    const mockWs = getLatestMock();
    expect(mockWs.sentMessages.length).toBe(1);
    const frame = JSON.parse(mockWs.sentMessages[0]);
    expect(frame.type).toBe("req");
    expect(frame.method).toBe("connect");
    expect(frame.params.minProtocol).toBe(3);
    expect(frame.params.maxProtocol).toBe(3);
    expect(frame.params.client.id).toBe("clawdis");
    expect(frame.params.client.version).toBe("1.0.0");
  });

  it("should include auth when token provided", async () => {
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      token: "test-token",
    });

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    const mockWs = getLatestMock();
    const frame = JSON.parse(mockWs.sentMessages[0]);
    expect(frame.params.auth).toEqual({ token: "test-token" });
  });

  it("should call onHello when connect succeeds", async () => {
    const onHello = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      onHello,
    });

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    const mockWs = getLatestMock();
    // Get the request ID
    const frame = JSON.parse(mockWs.sentMessages[0]);

    // Simulate hello-ok response
    mockWs.simulateMessage({
      type: "res",
      id: frame.id,
      ok: true,
      payload: {
        type: "hello-ok",
        protocol: 3,
        server: { version: "1.0.0", connId: "test-conn" },
        features: { methods: [], events: [] },
        policy: {
          maxPayload: 1000,
          maxBufferedBytes: 1000,
          tickIntervalMs: 1000,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(onHello).toHaveBeenCalled();
  });

  it("should handle event frames", async () => {
    const onEvent = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      onEvent,
    });

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    const mockWs = getLatestMock();
    // Simulate event
    mockWs.simulateMessage({
      type: "event",
      event: "chat.delta",
      payload: { delta: "Hello" },
      seq: 1,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "event",
      event: "chat.delta",
      payload: { delta: "Hello" },
      seq: 1,
    });
  });

  it("should detect sequence gaps", async () => {
    const onGap = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      onGap,
    });

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    const mockWs = getLatestMock();
    // Simulate events with gap
    mockWs.simulateMessage({ type: "event", event: "tick", seq: 1 });
    mockWs.simulateMessage({ type: "event", event: "tick", seq: 5 });

    expect(onGap).toHaveBeenCalledWith({ expected: 2, received: 5 });
  });

  it("should call onClose when WebSocket closes", async () => {
    const onClose = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      onClose,
    });

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    const mockWs = getLatestMock();
    mockWs.close(1000, "normal closure");

    expect(onClose).toHaveBeenCalledWith({
      code: 1000,
      reason: "normal closure",
    });
  });

  it("should disconnect and flush pending requests", async () => {
    const client = new GatewayClient({ url: "ws://localhost:18789" });

    client.connect();
    await new Promise((r) => setTimeout(r, 10));

    const requestPromise = client.request("test.method");

    client.disconnect();

    await expect(requestPromise).rejects.toThrow("gateway client stopped");
    expect(client.connected).toBe(false);
  });

  describe("reconnection with backoff", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should auto-reconnect on unexpected close", async () => {
      const onReconnecting = vi.fn();
      const client = new GatewayClient({
        url: "ws://localhost:18789",
        autoReconnect: true,
        onReconnecting,
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10);

      const mockWs = getLatestMock();
      // Simulate unexpected close
      mockWs.close(1006, "abnormal closure");

      // Should schedule reconnect
      expect(onReconnecting).toHaveBeenCalledWith(1, 1000);
    });

    it("should not reconnect when disconnect() called deliberately", async () => {
      const onReconnecting = vi.fn();
      const client = new GatewayClient({
        url: "ws://localhost:18789",
        autoReconnect: true,
        onReconnecting,
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10);

      // Deliberate disconnect
      client.disconnect();

      expect(onReconnecting).not.toHaveBeenCalled();
      expect(client.isClosed).toBe(true);
    });

    it("should use exponential backoff (1s, 2s, 4s, 8s, 16s)", async () => {
      const onReconnecting = vi.fn();
      const client = new GatewayClient({
        url: "ws://localhost:18789",
        autoReconnect: true,
        maxRetries: 5,
        onReconnecting,
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10);

      // First close - schedules at 1000ms, then doubles backoff to 2000ms
      getLatestMock().close(1006, "error");
      expect(onReconnecting).toHaveBeenLastCalledWith(1, 1000);
      expect(client.currentBackoffMs).toBe(2000); // Doubled after scheduling

      // Advance just before timer fires
      await vi.advanceTimersByTimeAsync(999);
      expect(createdMocks.length).toBe(1); // No new connection yet

      // Timer fires, new WebSocket created
      await vi.advanceTimersByTimeAsync(2);
      expect(createdMocks.length).toBe(2);

      // Connection opens successfully - backoff resets
      await vi.advanceTimersByTimeAsync(10);
      expect(client.currentBackoffMs).toBe(1000); // Reset on success
      expect(client.currentRetryCount).toBe(0);
    });

    it("should call onReconnectFailed after max retries", async () => {
      const onReconnecting = vi.fn();
      const onReconnectFailed = vi.fn();
      const client = new GatewayClient({
        url: "ws://localhost:18789",
        autoReconnect: true,
        maxRetries: 2,
        onReconnecting,
        onReconnectFailed,
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10);

      // First close - schedules retry 1
      getLatestMock().close(1006, "error");
      expect(client.currentRetryCount).toBe(1);
      expect(onReconnecting).toHaveBeenCalledWith(1, 1000);
      expect(onReconnectFailed).not.toHaveBeenCalled();

      // Disable auto-open for subsequent connections to simulate failures
      mockShouldAutoOpen = false;

      // Advance timer - reconnect fires, new WS created but doesn't open
      await vi.advanceTimersByTimeAsync(1000);
      expect(createdMocks.length).toBe(2);

      // Connection fails (closes without ever opening)
      getLatestMock().close(1006, "connection failed");
      expect(client.currentRetryCount).toBe(2);
      expect(onReconnecting).toHaveBeenCalledWith(2, 2000);
      expect(onReconnectFailed).not.toHaveBeenCalled();

      // Advance timer - another reconnect
      await vi.advanceTimersByTimeAsync(2000);
      expect(createdMocks.length).toBe(3);

      // This close exceeds max retries
      getLatestMock().close(1006, "connection failed");
      expect(onReconnectFailed).toHaveBeenCalled();
      expect(onReconnecting).toHaveBeenCalledTimes(2); // Should not call again
    });

    it("should reset backoff on successful connection", async () => {
      const onReconnecting = vi.fn();
      const client = new GatewayClient({
        url: "ws://localhost:18789",
        autoReconnect: true,
        onReconnecting,
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10);

      // First close
      getLatestMock().close(1006, "error");
      expect(onReconnecting).toHaveBeenCalledWith(1, 1000);

      // Reconnect succeeds
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(10);

      // Verify backoff was reset (next close should start at 1000ms again)
      expect(client.currentBackoffMs).toBe(1000);
      expect(client.currentRetryCount).toBe(0);
    });
  });
});
