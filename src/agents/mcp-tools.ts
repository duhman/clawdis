/**
 * MCP Tools Adapter
 *
 * Converts MCP server tools to Clawdis AgentTools.
 * Each MCP tool becomes an AgentTool with name `mcp__<server>__<tool>`.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { McpConfig } from "../config/config.js";
import {
  getMcpRegistry,
  initMcpRegistry,
  type McpToolSchema,
} from "../infra/mcp/registry.js";

// biome-ignore lint/suspicious/noExplicitAny: TypeBox schema type flexibility
type AnyAgentTool = AgentTool<any, unknown>;

// ─── Tool Generation ──────────────────────────────────────────────────────────

/**
 * Convert MCP JSON Schema to TypeBox schema for agent tool parameters.
 * Falls back to a flexible object schema if conversion fails.
 */
function mcpSchemaToTypebox(inputSchema?: Record<string, unknown>) {
  // If no schema provided, accept any object
  if (!inputSchema || typeof inputSchema !== "object") {
    return Type.Object({}, { additionalProperties: true });
  }

  // For now, use a flexible passthrough that accepts any properties
  // A full JSON Schema to TypeBox converter would be more complex
  return Type.Object({}, { additionalProperties: true });
}

/**
 * Create an AgentTool from an MCP tool definition.
 */
function createMcpAgentTool(
  serverName: string,
  tool: McpToolSchema,
): AnyAgentTool {
  const toolName = `mcp__${serverName}__${tool.name}`;

  return {
    label: `MCP: ${serverName}/${tool.name}`,
    name: toolName,
    description: tool.description ?? `MCP tool ${tool.name} from ${serverName}`,
    parameters: mcpSchemaToTypebox(tool.inputSchema),
    execute: async (_toolCallId, args): Promise<AgentToolResult<unknown>> => {
      const registry = getMcpRegistry();
      if (!registry) {
        throw new Error("MCP registry not initialized");
      }

      const params = (args ?? {}) as Record<string, unknown>;
      const result = await registry.callTool(serverName, tool.name, params);

      // Convert MCP result to AgentToolResult
      const content: AgentToolResult<unknown>["content"] = [];

      for (const item of result.content) {
        if (item.type === "text" && item.text) {
          content.push({ type: "text", text: item.text });
        } else if (item.type === "image" && item.data && item.mimeType) {
          content.push({
            type: "image",
            data: item.data,
            mimeType: item.mimeType,
          });
        } else if (item.type === "resource" && item.text) {
          content.push({ type: "text", text: item.text });
        }
      }

      // If no content, add a placeholder
      if (content.length === 0) {
        content.push({ type: "text", text: JSON.stringify(result, null, 2) });
      }

      return {
        content,
        details: result,
      };
    },
  };
}

// ─── Registry Integration ─────────────────────────────────────────────────────

/**
 * Initialize MCP and create AgentTools for all available MCP tools.
 * Should be called at agent startup.
 */
export async function createMcpTools(
  config: McpConfig,
): Promise<AnyAgentTool[]> {
  if (config.enabled === false) {
    return [];
  }

  if (!config.servers || Object.keys(config.servers).length === 0) {
    return [];
  }

  // Initialize the global registry
  const registry = initMcpRegistry(config);
  const tools: AnyAgentTool[] = [];

  // Start each enabled server and collect tools
  for (const serverName of registry.serverNames) {
    try {
      const client = await registry.getClient(serverName);
      for (const mcpTool of client.availableTools) {
        tools.push(createMcpAgentTool(serverName, mcpTool));
      }
      console.log(
        `[MCP] Loaded ${client.availableTools.length} tools from ${serverName}`,
      );
    } catch (err) {
      console.error(`[MCP] Failed to start server ${serverName}:`, err);
      // Continue with other servers
    }
  }

  return tools;
}

/**
 * Create a single MCP call tool that can invoke any MCP server/tool combination.
 * This is an alternative to generating individual tools for each MCP tool.
 */
export function createMcpCallTool(): AnyAgentTool {
  return {
    label: "MCP Call",
    name: "mcp_call",
    description:
      "Call any MCP server tool. Use mcp__<server>__<tool> naming or specify server/tool separately.",
    parameters: Type.Object({
      server: Type.String({ description: "MCP server name" }),
      tool: Type.String({ description: "Tool name on the server" }),
      args: Type.Optional(
        Type.Object(
          {},
          { additionalProperties: true, description: "Tool arguments" },
        ),
      ),
      timeoutMs: Type.Optional(
        Type.Number({ description: "Call timeout in ms" }),
      ),
    }),
    execute: async (_toolCallId, params): Promise<AgentToolResult<unknown>> => {
      const registry = getMcpRegistry();
      if (!registry) {
        throw new Error("MCP registry not initialized");
      }

      const {
        server,
        tool,
        args = {},
        timeoutMs,
      } = params as {
        server: string;
        tool: string;
        args?: Record<string, unknown>;
        timeoutMs?: number;
      };

      const result = await registry.callTool(server, tool, args, timeoutMs);

      // Convert MCP result to AgentToolResult
      const content: AgentToolResult<unknown>["content"] = [];

      for (const item of result.content) {
        if (item.type === "text" && item.text) {
          content.push({ type: "text", text: item.text });
        } else if (item.type === "image" && item.data && item.mimeType) {
          content.push({
            type: "image",
            data: item.data,
            mimeType: item.mimeType,
          });
        }
      }

      if (content.length === 0) {
        content.push({ type: "text", text: JSON.stringify(result, null, 2) });
      }

      return {
        content,
        details: result,
      };
    },
  };
}

/**
 * List all available MCP tools across all servers.
 */
export async function listMcpTools(): Promise<
  Array<{ server: string; tool: McpToolSchema }>
> {
  const registry = getMcpRegistry();
  if (!registry) {
    return [];
  }
  return await registry.listAllTools();
}
