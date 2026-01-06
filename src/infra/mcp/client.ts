/**
 * MCP (Model Context Protocol) JSON-RPC Client
 *
 * Communicates with MCP servers over stdio using JSON-RPC 2.0.
 * Manages server lifecycle (spawn, initialize, call tools, shutdown).
 */

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";

import type { McpServerConfig } from "../../config/config.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type McpToolSchema = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type McpServerInfo = {
  name: string;
  version?: string;
  protocolVersion?: string;
};

export type McpToolResult = {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

// ─── MCP Client ───────────────────────────────────────────────────────────────

export class McpClient extends EventEmitter {
  readonly serverName: string;
  private config: McpServerConfig;
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number | string, PendingRequest>();
  private serverInfo: McpServerInfo | null = null;
  private tools: McpToolSchema[] = [];
  private initialized = false;
  private closed = false;

  constructor(serverName: string, config: McpServerConfig) {
    super();
    this.serverName = serverName;
    this.config = config;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get availableTools(): McpToolSchema[] {
    return [...this.tools];
  }

  get server(): McpServerInfo | null {
    return this.serverInfo;
  }

  /**
   * Start the MCP server process and initialize the connection.
   */
  async start(): Promise<void> {
    if (this.closed) {
      throw new Error(`MCP client ${this.serverName} is closed`);
    }
    if (this.process) {
      throw new Error(`MCP server ${this.serverName} already started`);
    }

    const { command, args = [], env = {} } = this.config;
    const initTimeout = this.config.initTimeoutMs ?? 30_000;

    // Spawn the MCP server process
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
      shell: false,
    });

    const proc = this.process;

    // Handle stdout (JSON-RPC responses)
    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout });
      rl.on("line", (line) => this.handleLine(line));
    }

    // Handle stderr (log to console for debugging)
    if (proc.stderr) {
      const rl = createInterface({ input: proc.stderr });
      rl.on("line", (line) => {
        this.emit("stderr", line);
      });
    }

    // Handle process exit
    proc.on("exit", (code, signal) => {
      this.closed = true;
      this.rejectAllPending(
        new Error(
          `MCP server ${this.serverName} exited (code=${code}, signal=${signal})`,
        ),
      );
      this.emit("exit", { code, signal });
    });

    proc.on("error", (err) => {
      this.closed = true;
      this.rejectAllPending(err);
      this.emit("error", err);
    });

    // Initialize the MCP connection
    try {
      const initResult = (await this.call(
        "initialize",
        {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: "clawdis",
            version: "1.0.0",
          },
        },
        initTimeout,
      )) as {
        protocolVersion?: string;
        serverInfo?: { name?: string; version?: string };
        capabilities?: unknown;
      };

      this.serverInfo = {
        name: initResult.serverInfo?.name ?? this.serverName,
        version: initResult.serverInfo?.version,
        protocolVersion: initResult.protocolVersion,
      };

      // Send initialized notification
      this.notify("notifications/initialized", {});

      // List available tools
      const toolsResult = (await this.call("tools/list", {}, initTimeout)) as {
        tools?: McpToolSchema[];
      };
      this.tools = toolsResult.tools ?? [];

      this.initialized = true;
      this.emit("initialized", {
        serverInfo: this.serverInfo,
        tools: this.tools,
      });
    } catch (err) {
      await this.stop();
      throw err;
    }
  }

  /**
   * Call an MCP tool by name.
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<McpToolResult> {
    if (!this.initialized) {
      throw new Error(`MCP server ${this.serverName} not initialized`);
    }

    const timeout = timeoutMs ?? this.config.callTimeoutMs ?? 60_000;
    const result = (await this.call(
      "tools/call",
      { name: toolName, arguments: args },
      timeout,
    )) as McpToolResult;

    return result;
  }

  /**
   * Stop the MCP server process.
   */
  async stop(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.process) {
      try {
        this.process.kill("SIGTERM");
      } catch {
        // Ignore kill errors
      }
      this.process = null;
    }

    this.rejectAllPending(new Error(`MCP server ${this.serverName} stopped`));
    this.emit("stopped");
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private async call(
    method: string,
    params: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!this.process?.stdin) {
      throw new Error(`MCP server ${this.serverName} not started`);
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP call ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeoutId });

      const line = `${JSON.stringify(request)}\n`;
      this.process?.stdin?.write(line);
    });
  }

  private notify(method: string, params: unknown): void {
    if (!this.process?.stdin) return;

    const notification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    const line = `${JSON.stringify(notification)}\n`;
    this.process.stdin.write(line);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const msg = JSON.parse(trimmed) as JsonRpcResponse;

      // Handle response
      if (msg.id !== undefined && msg.id !== null) {
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          clearTimeout(pending.timeoutId);

          if (msg.error) {
            pending.reject(
              new Error(
                `MCP error: ${msg.error.message} (code=${msg.error.code})`,
              ),
            );
          } else {
            pending.resolve(msg.result);
          }
        }
      }

      // Handle notifications (no id)
      if (msg.id === undefined || msg.id === null) {
        this.emit("notification", msg);
      }
    } catch {
      this.emit("parseError", { line });
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [_id, pending] of this.pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
