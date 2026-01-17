/**
 * Gateway Commands for Clawdis Launcher
 * Commands that interact with the Clawdbot Gateway
 */

import type { Command } from "./commands";
import type { GatewayClient } from "../gateway/client";

export interface GatewayCommandHandlers {
  sendMessage?: (message: string) => void | Promise<void>;
  abortGeneration?: () => void | Promise<void>;
  clearHistory?: () => void | Promise<void>;
  reconnect?: () => void | Promise<void>;
}

/**
 * Create gateway commands with handlers
 */
export function createGatewayCommands(
  client: GatewayClient | null,
  handlers: GatewayCommandHandlers = {},
): Command[] {
  const commands: Command[] = [];

  // Only add commands if client is available
  if (client) {
    commands.push({
      id: "gateway-status",
      name: "Connection Status",
      description: client.connected
        ? "Connected to Clawdbot Gateway"
        : "Disconnected - click to reconnect",
      keywords: ["connection", "gateway", "status", "connected"],
      icon: client.connected ? "🟢" : "🔴",
      action: async () => {
        if (!client.connected && handlers.reconnect) {
          await handlers.reconnect();
        }
      },
    });

    if (client.connected) {
      commands.push({
        id: "abort",
        name: "Stop Generation",
        description: "Abort the current AI response",
        keywords: ["stop", "cancel", "abort", "halt"],
        icon: "⏹️",
        action: handlers.abortGeneration ?? (() => {}),
      });

      commands.push({
        id: "clear-history",
        name: "Clear Chat History",
        description: "Clear all messages in the current session",
        keywords: ["delete", "reset", "clear", "messages"],
        icon: "🗑️",
        action: handlers.clearHistory ?? (() => {}),
      });
    }
  }

  // Add reconnect command when disconnected
  if (!client?.connected) {
    commands.push({
      id: "reconnect",
      name: "Reconnect",
      description: "Reconnect to Clawdbot Gateway",
      keywords: ["connect", "reconnect", "gateway"],
      icon: "🔄",
      action: handlers.reconnect ?? (() => console.log("Reconnect")),
    });
  }

  return commands;
}

/**
 * Create a quick message command
 */
export function createQuickMessageCommand(
  id: string,
  name: string,
  message: string,
  sendMessage: (msg: string) => void | Promise<void>,
): Command {
  return {
    id: `quick-${id}`,
    name,
    description: `Send: "${message}"`,
    keywords: ["quick", "send", "message"],
    icon: "⚡",
    action: () => sendMessage(message),
  };
}
