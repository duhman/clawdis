/**
 * MCP Server Registry
 *
 * Manages the lifecycle of MCP servers: on-demand spawning, caching, and shutdown.
 * Servers are spawned when first accessed and shut down after idle timeout.
 */

import type { McpConfig, McpServerConfig } from "../../config/config.js";
import { McpClient, type McpToolSchema } from "./client.js";

// Re-export types for external use
export type { McpToolSchema } from "./client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type McpServerStatus = {
  serverName: string;
  initialized: boolean;
  tools: McpToolSchema[];
  serverInfo: { name: string; version?: string } | null;
  error?: string;
};

export type McpRegistryStatus = {
  enabled: boolean;
  servers: Record<string, McpServerStatus>;
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export class McpRegistry {
  private config: McpConfig;
  private clients = new Map<string, McpClient>();
  private startPromises = new Map<string, Promise<McpClient>>();

  constructor(config: McpConfig) {
    this.config = config;
  }

  /**
   * Check if MCP is enabled globally.
   */
  get isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Get list of configured server names.
   */
  get serverNames(): string[] {
    if (!this.config.servers) return [];
    return Object.keys(this.config.servers).filter((name) => {
      const cfg = this.config.servers?.[name];
      return cfg && cfg.enabled !== false;
    });
  }

  /**
   * Get a server configuration by name.
   */
  getServerConfig(serverName: string): McpServerConfig | undefined {
    return this.config.servers?.[serverName];
  }

  /**
   * Get or start an MCP client for a server (on-demand).
   */
  async getClient(serverName: string): Promise<McpClient> {
    if (!this.isEnabled) {
      throw new Error("MCP is disabled in configuration");
    }

    const cfg = this.getServerConfig(serverName);
    if (!cfg) {
      throw new Error(`MCP server "${serverName}" not configured`);
    }
    if (cfg.enabled === false) {
      throw new Error(`MCP server "${serverName}" is disabled`);
    }

    // Return existing client if initialized
    const existing = this.clients.get(serverName);
    if (existing?.isInitialized && !existing.isClosed) {
      return existing;
    }

    // Check if already starting
    const pending = this.startPromises.get(serverName);
    if (pending) {
      return pending;
    }

    // Start new client
    const startPromise = this.startClient(serverName, cfg);
    this.startPromises.set(serverName, startPromise);

    try {
      const client = await startPromise;
      this.clients.set(serverName, client);
      return client;
    } finally {
      this.startPromises.delete(serverName);
    }
  }

  /**
   * Call a tool on a specific MCP server.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs?: number,
  ) {
    const client = await this.getClient(serverName);
    return await client.callTool(toolName, args, timeoutMs);
  }

  /**
   * List all available tools across all servers.
   */
  async listAllTools(): Promise<
    Array<{ server: string; tool: McpToolSchema }>
  > {
    const result: Array<{ server: string; tool: McpToolSchema }> = [];

    for (const serverName of this.serverNames) {
      try {
        const client = await this.getClient(serverName);
        for (const tool of client.availableTools) {
          result.push({ server: serverName, tool });
        }
      } catch {
        // Skip servers that fail to start
      }
    }

    return result;
  }

  /**
   * Get status of all configured servers.
   */
  async getStatus(): Promise<McpRegistryStatus> {
    const servers: Record<string, McpServerStatus> = {};

    for (const serverName of this.serverNames) {
      try {
        const client = this.clients.get(serverName);
        if (client?.isInitialized && !client.isClosed) {
          servers[serverName] = {
            serverName,
            initialized: true,
            tools: client.availableTools,
            serverInfo: client.server,
          };
        } else {
          servers[serverName] = {
            serverName,
            initialized: false,
            tools: [],
            serverInfo: null,
          };
        }
      } catch (err) {
        servers[serverName] = {
          serverName,
          initialized: false,
          tools: [],
          serverInfo: null,
          error: String(err),
        };
      }
    }

    return {
      enabled: this.isEnabled,
      servers,
    };
  }

  /**
   * Stop a specific server.
   */
  async stopServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.stop();
      this.clients.delete(serverName);
    }
  }

  /**
   * Stop all servers and clean up.
   */
  async shutdown(): Promise<void> {
    const stopPromises = [...this.clients.keys()].map((name) =>
      this.stopServer(name),
    );
    await Promise.allSettled(stopPromises);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private async startClient(
    serverName: string,
    cfg: McpServerConfig,
  ): Promise<McpClient> {
    const client = new McpClient(serverName, cfg);

    // Set up event handlers
    client.on("exit", ({ code, signal }) => {
      console.log(
        `[MCP] Server ${serverName} exited (code=${code}, signal=${signal})`,
      );
      this.clients.delete(serverName);
    });

    client.on("error", (err) => {
      console.error(`[MCP] Server ${serverName} error:`, err);
    });

    client.on("stderr", (line: string) => {
      // Log stderr for debugging (could be filtered in production)
      console.log(`[MCP:${serverName}] ${line}`);
    });

    await client.start();
    return client;
  }
}

// ─── Singleton Registry ───────────────────────────────────────────────────────

let globalRegistry: McpRegistry | null = null;

/**
 * Initialize the global MCP registry from config.
 */
export function initMcpRegistry(config: McpConfig): McpRegistry {
  if (globalRegistry) {
    // Shutdown existing registry before replacing
    globalRegistry.shutdown().catch(() => {});
  }
  globalRegistry = new McpRegistry(config);
  return globalRegistry;
}

/**
 * Get the global MCP registry (must be initialized first).
 */
export function getMcpRegistry(): McpRegistry | null {
  return globalRegistry;
}

/**
 * Shutdown the global MCP registry.
 */
export async function shutdownMcpRegistry(): Promise<void> {
  if (globalRegistry) {
    await globalRegistry.shutdown();
    globalRegistry = null;
  }
}
