/**
 * useLauncherWindow Hook
 * Manages the launcher window lifecycle
 */

import { useState, useCallback, useEffect, useRef } from "react";

// Check if running in Tauri
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

// Lazy WebviewWindow type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebviewWindowType = any;

export interface UseLauncherWindowOptions {
  width?: number;
  height?: number;
}

export interface UseLauncherWindowReturn {
  isVisible: boolean;
  isReady: boolean;
  show: () => Promise<void>;
  hide: () => Promise<void>;
  toggle: () => Promise<void>;
}

const LAUNCHER_LABEL = "launcher";
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

/**
 * Hook for managing the launcher window
 */
export function useLauncherWindow(
  options: UseLauncherWindowOptions = {},
): UseLauncherWindowReturn {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const windowRef = useRef<WebviewWindowType | null>(null);

  // Initialize launcher window
  useEffect(() => {
    if (!isTauri()) {
      setIsReady(true); // Pretend ready when not in Tauri
      return;
    }

    const initWindow = async () => {
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

        // Check if launcher window already exists
        const existing = await WebviewWindow.getByLabel(LAUNCHER_LABEL);
        if (existing) {
          windowRef.current = existing;
          setIsReady(true);
          return;
        }

        // Create new launcher window
        const launcher = new WebviewWindow(LAUNCHER_LABEL, {
          url: "/launcher",
          title: "Clawdis Launcher",
          width,
          height,
          center: true,
          decorations: false,
          transparent: true,
          alwaysOnTop: true,
          visible: false,
          resizable: false,
          skipTaskbar: true,
          focus: true,
        });

        // Wait for window to be created
        launcher.once("tauri://created", () => {
          windowRef.current = launcher;
          setIsReady(true);
        });

        launcher.once("tauri://error", (e: unknown) => {
          console.error("Failed to create launcher window:", e);
        });

        // Hide on blur
        launcher.listen("tauri://blur", () => {
          setIsVisible(false);
        });
      } catch (err) {
        console.error("Failed to initialize launcher window:", err);
      }
    };

    initWindow();

    return () => {
      // Cleanup: close the launcher window
      windowRef.current?.close().catch(() => {});
    };
  }, [width, height]);

  const show = useCallback(async () => {
    if (!windowRef.current) return;

    try {
      await windowRef.current.show();
      await windowRef.current.setFocus();
      await windowRef.current.center();
      setIsVisible(true);
    } catch (err) {
      console.error("Failed to show launcher:", err);
    }
  }, []);

  const hide = useCallback(async () => {
    if (!windowRef.current) return;

    try {
      await windowRef.current.hide();
      setIsVisible(false);
    } catch (err) {
      console.error("Failed to hide launcher:", err);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isVisible) {
      await hide();
    } else {
      await show();
    }
  }, [isVisible, show, hide]);

  return {
    isVisible,
    isReady,
    show,
    hide,
    toggle,
  };
}
