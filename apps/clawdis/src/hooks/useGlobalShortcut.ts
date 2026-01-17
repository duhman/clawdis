/**
 * useGlobalShortcut Hook
 * Registers global keyboard shortcuts using Tauri plugin
 */

import { useEffect, useRef } from "react";

// Lazy-load shortcut functions only when in Tauri
type ShortcutApi = {
  register: (shortcut: string, handler: () => void) => Promise<void>;
  unregister: (shortcut: string) => Promise<void>;
  isRegistered: (shortcut: string) => Promise<boolean>;
};

let shortcutApi: ShortcutApi | null = null;

async function getShortcutApi(): Promise<ShortcutApi | null> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    return null;
  }

  if (!shortcutApi) {
    try {
      const mod = await import("@tauri-apps/plugin-global-shortcut");
      shortcutApi = {
        register: mod.register,
        unregister: mod.unregister,
        isRegistered: mod.isRegistered,
      };
    } catch (err) {
      console.error("[global-shortcut] Failed to load Tauri plugin:", err);
      return null;
    }
  }
  return shortcutApi;
}

export interface UseGlobalShortcutOptions {
  shortcut: string;
  onActivate: () => void;
  enabled?: boolean;
}

/**
 * Hook for registering global keyboard shortcuts
 */
export function useGlobalShortcut({
  shortcut,
  onActivate,
  enabled = true,
}: UseGlobalShortcutOptions): void {
  const callbackRef = useRef(onActivate);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const setupShortcut = async () => {
      const api = await getShortcutApi();
      if (!api) return; // Not in Tauri

      try {
        // Check if already registered
        const alreadyRegistered = await api.isRegistered(shortcut);
        if (alreadyRegistered) {
          await api.unregister(shortcut);
        }

        if (!mounted) return;

        // Register the shortcut
        await api.register(shortcut, () => {
          callbackRef.current();
        });
      } catch (err) {
        console.error(`Failed to register shortcut ${shortcut}:`, err);
      }
    };

    setupShortcut();

    return () => {
      mounted = false;
      getShortcutApi().then((api) => {
        if (api) {
          api.unregister(shortcut).catch(() => {
            // Ignore errors during cleanup
          });
        }
      });
    };
  }, [shortcut, enabled]);
}

/**
 * Common shortcuts
 */
export const SHORTCUTS = {
  LAUNCHER: "CommandOrControl+Shift+Space",
  QUICK_SEARCH: "CommandOrControl+K",
} as const;
