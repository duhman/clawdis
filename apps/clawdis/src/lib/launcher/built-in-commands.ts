/**
 * Built-in Commands for Clawdis Launcher
 */

import type { Command } from "./commands";

export interface BuiltInCommandHandlers {
  openChat?: () => void | Promise<void>;
  openSearch?: () => void | Promise<void>;
  openSettings?: () => void | Promise<void>;
  newChat?: () => void | Promise<void>;
  toggleTheme?: () => void | Promise<void>;
}

/**
 * Create built-in commands with custom handlers
 */
export function createBuiltInCommands(
  handlers: BuiltInCommandHandlers = {},
): Command[] {
  return [
    {
      id: "chat",
      name: "Chat",
      description: "Open the chat interface",
      keywords: ["message", "conversation", "talk", "ai"],
      icon: "💬",
      action: handlers.openChat ?? (() => console.log("Open chat")),
    },
    {
      id: "new-chat",
      name: "New Chat",
      description: "Start a new conversation",
      keywords: ["fresh", "reset", "clear", "new conversation"],
      icon: "✨",
      action: handlers.newChat ?? (() => console.log("New chat")),
    },
    {
      id: "search",
      name: "Search",
      description: "Search your conversation history",
      keywords: ["find", "lookup", "query", "history"],
      icon: "🔍",
      action: handlers.openSearch ?? (() => console.log("Open search")),
    },
    {
      id: "settings",
      name: "Settings",
      description: "Open application settings",
      keywords: ["preferences", "config", "options", "configure"],
      icon: "⚙️",
      action: handlers.openSettings ?? (() => console.log("Open settings")),
    },
    {
      id: "theme",
      name: "Toggle Theme",
      description: "Switch between light and dark mode",
      keywords: ["dark mode", "light mode", "appearance", "color"],
      icon: "🌓",
      action: handlers.toggleTheme ?? (() => console.log("Toggle theme")),
    },
  ];
}

/**
 * Default built-in commands (with console.log placeholders)
 */
export const defaultCommands = createBuiltInCommands();
