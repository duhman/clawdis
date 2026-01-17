/**
 * useWindowState Hook
 * Tracks and persists window position and size
 */

import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/settings";

// Check if running in Tauri
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export interface UseWindowStateOptions {
  /** Enable window state tracking */
  enabled?: boolean;
  /** Debounce time for saving state (ms) */
  debounceMs?: number;
}

/**
 * Hook for tracking and persisting window state
 *
 * Listens to window move/resize events and saves the state to persistent storage.
 * On mount, restores the window state from storage.
 */
export function useWindowState(options: UseWindowStateOptions = {}): void {
  const { enabled = true, debounceMs = 500 } = options;

  const windowState = useSettingsStore((s) => s.windowState);
  const setWindowState = useSettingsStore((s) => s.setWindowState);
  const isInitialized = useSettingsStore((s) => s.isInitialized);
  const load = useSettingsStore((s) => s.load);

  // Track debounce timeout
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (enabled) {
      load();
    }
  }, [enabled, load]);

  // Restore window state when settings are initialized
  useEffect(() => {
    if (!enabled || !isInitialized || !windowState || !isTauri()) return;

    const restoreState = async () => {
      try {
        const { getCurrentWindow, PhysicalPosition, PhysicalSize } =
          await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const { x, y, width, height, maximized } = windowState;

        // Set position and size
        await win.setPosition(new PhysicalPosition(x, y));
        await win.setSize(new PhysicalSize(width, height));

        // Restore maximized state
        if (maximized) {
          await win.maximize();
        }
      } catch (err) {
        console.error("Failed to restore window state:", err);
      }
    };

    restoreState();
  }, [enabled, isInitialized, windowState]);

  // Track window state changes
  useEffect(() => {
    if (!enabled || !isTauri()) return;

    let unlistenMove: (() => void) | null = null;
    let unlistenResize: (() => void) | null = null;

    const setup = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();

      const debouncedSave = () => {
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }

        saveTimeout.current = setTimeout(async () => {
          try {
            const position = await win.outerPosition();
            const size = await win.outerSize();
            const maximized = await win.isMaximized();

            setWindowState({
              x: position.x,
              y: position.y,
              width: size.width,
              height: size.height,
              maximized,
            });
          } catch (err) {
            console.error("Failed to get window state:", err);
          }
        }, debounceMs);
      };

      // Subscribe to window events
      unlistenMove = await win.onMoved(() => debouncedSave());
      unlistenResize = await win.onResized(() => debouncedSave());
    };

    setup();

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      unlistenMove?.();
      unlistenResize?.();
    };
  }, [enabled, debounceMs, setWindowState]);
}
