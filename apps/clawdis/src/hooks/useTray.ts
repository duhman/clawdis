/**
 * useTray Hook
 * Listens for tray menu events emitted from Rust and syncs connection status
 */

import { useEffect, useRef, useCallback } from "react";
import type { ConnectionStatus, TokenUsage } from "../stores/gateway";
import type { HealthStatus } from "./useHealth";

// Lazy-load Tauri API only when in Tauri
type TauriApi = {
  listen: (
    event: string,
    handler: (event: unknown) => void,
  ) => Promise<() => void>;
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

let tauriApi: TauriApi | null = null;

async function getTauriApi(): Promise<TauriApi | null> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    return null;
  }

  if (!tauriApi) {
    try {
      const eventMod = await import("@tauri-apps/api/event");
      const coreMod = await import("@tauri-apps/api/core");
      tauriApi = {
        listen: eventMod.listen,
        invoke: coreMod.invoke,
      };
    } catch (err) {
      console.error("[useTray] Failed to load Tauri API:", err);
      return null;
    }
  }
  return tauriApi;
}

export interface HealthInfo {
  status: HealthStatus;
  latency: number | null;
}

export interface UseTrayOptions {
  onNewChat?: () => void;
  onSettings?: () => void;
  /** Connection status to sync with tray */
  connectionStatus?: ConnectionStatus;
  /** Token usage to sync with tray */
  usage?: TokenUsage;
  /** Health info to sync with tray */
  health?: HealthInfo;
}

export interface UseTrayReturn {
  /** Trigger new chat action programmatically */
  triggerNewChat: () => void;
  /** Trigger settings action programmatically */
  triggerSettings: () => void;
  /** Update tray connection status */
  setTrayStatus: (status: ConnectionStatus) => Promise<void>;
  /** Update tray token usage */
  setTrayUsage: (usage: TokenUsage) => Promise<void>;
  /** Update tray health status */
  setTrayHealth: (health: HealthInfo) => Promise<void>;
}

/**
 * Hook for listening to tray menu events and syncing connection status
 *
 * Tray events are emitted from Rust when menu items are clicked.
 * This hook subscribes to those events and calls the appropriate callbacks.
 * It also syncs the connection status to the tray icon/menu.
 */
export function useTray(options: UseTrayOptions = {}): UseTrayReturn {
  const { onNewChat, onSettings, connectionStatus, usage, health } = options;

  // Keep callback refs updated to avoid stale closures
  const onNewChatRef = useRef(onNewChat);
  const onSettingsRef = useRef(onSettings);

  useEffect(() => {
    onNewChatRef.current = onNewChat;
  }, [onNewChat]);

  useEffect(() => {
    onSettingsRef.current = onSettings;
  }, [onSettings]);

  // Listen for tray-new-chat event
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    getTauriApi().then((api) => {
      if (!api) return;
      api
        .listen("tray-new-chat", () => {
          onNewChatRef.current?.();
        })
        .then((unlisten) => {
          cleanup = unlisten;
        });
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // Listen for tray-settings event
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    getTauriApi().then((api) => {
      if (!api) return;
      api
        .listen("tray-settings", () => {
          onSettingsRef.current?.();
        })
        .then((unlisten) => {
          cleanup = unlisten;
        });
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // Sync connection status to tray
  useEffect(() => {
    if (connectionStatus) {
      getTauriApi().then((api) => {
        if (!api) return;
        api
          .invoke("set_tray_status", { status: connectionStatus })
          .catch((err) => {
            console.error("Failed to update tray status:", err);
          });
      });
    }
  }, [connectionStatus]);

  // Sync usage to tray
  useEffect(() => {
    if (usage) {
      getTauriApi().then((api) => {
        if (!api) return;
        api.invoke("set_tray_usage", { usage }).catch((err) => {
          console.error("Failed to update tray usage:", err);
        });
      });
    }
  }, [usage]);

  // Sync health to tray
  useEffect(() => {
    if (health) {
      getTauriApi().then((api) => {
        if (!api) return;
        api.invoke("set_tray_health", { health }).catch((err) => {
          console.error("Failed to update tray health:", err);
        });
      });
    }
  }, [health]);

  // Programmatic triggers (for keyboard shortcuts, etc.)
  const triggerNewChat = useCallback(() => {
    onNewChatRef.current?.();
  }, []);

  const triggerSettings = useCallback(() => {
    onSettingsRef.current?.();
  }, []);

  const setTrayStatus = useCallback(async (status: ConnectionStatus) => {
    const api = await getTauriApi();
    if (!api) return;
    try {
      await api.invoke("set_tray_status", { status });
    } catch (err) {
      console.error("Failed to update tray status:", err);
    }
  }, []);

  const setTrayUsage = useCallback(async (usageArg: TokenUsage) => {
    const api = await getTauriApi();
    if (!api) return;
    try {
      await api.invoke("set_tray_usage", { usage: usageArg });
    } catch (err) {
      console.error("Failed to update tray usage:", err);
    }
  }, []);

  const setTrayHealth = useCallback(async (healthArg: HealthInfo) => {
    const api = await getTauriApi();
    if (!api) return;
    try {
      await api.invoke("set_tray_health", { health: healthArg });
    } catch (err) {
      console.error("Failed to update tray health:", err);
    }
  }, []);

  return {
    triggerNewChat,
    triggerSettings,
    setTrayStatus,
    setTrayUsage,
    setTrayHealth,
  };
}
