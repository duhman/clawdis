/**
 * Updater Hook
 * Handles checking for updates, downloading, and installing
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSettingsStore } from "../stores/settings";
import { useNotifications } from "./useNotifications";

// Lazy-load updater functions only when in Tauri
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdaterCheckFn = () => Promise<any>;
type RelaunchFn = () => Promise<void>;

interface UpdaterApi {
  check: UpdaterCheckFn;
  relaunch: RelaunchFn;
}

let updaterApi: UpdaterApi | null = null;

async function getUpdaterApi(): Promise<UpdaterApi | null> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    return null;
  }

  if (!updaterApi) {
    try {
      const updaterMod = await import("@tauri-apps/plugin-updater");
      const processMod = await import("@tauri-apps/plugin-process");
      updaterApi = {
        check: updaterMod.check as UpdaterCheckFn,
        relaunch: processMod.relaunch,
      };
    } catch (err) {
      console.error("[updater] Failed to load Tauri plugins:", err);
      return null;
    }
  }
  return updaterApi;
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface DownloadProgress {
  contentLength: number | null;
  downloaded: number;
}

export interface UseUpdaterOptions {
  /** Check for updates on mount (default: uses autoCheckUpdates setting) */
  checkOnMount?: boolean;
}

export interface UseUpdaterReturn {
  /** Current update status */
  status: UpdateStatus;
  /** Information about available update */
  updateInfo: UpdateInfo | null;
  /** Download progress (0-100) */
  progress: number;
  /** Error message if any */
  error: string | null;
  /** Check for updates */
  checkForUpdates: () => Promise<void>;
  /** Download and install the update */
  downloadAndInstall: () => Promise<void>;
  /** Restart the app to apply update */
  restartApp: () => Promise<void>;
  /** Whether auto-check is enabled */
  autoCheckEnabled: boolean;
  /** Toggle auto-check setting */
  setAutoCheckEnabled: (enabled: boolean) => void;
}

export function useUpdater(options: UseUpdaterOptions = {}): UseUpdaterReturn {
  const autoCheckUpdates = useSettingsStore((state) => state.autoCheckUpdates);
  const setAutoCheckUpdates = useSettingsStore(
    (state) => state.setAutoCheckUpdates,
  );
  const { checkOnMount = autoCheckUpdates } = options;

  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { notify } = useNotifications();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateRef = useRef<any>(null);
  const hasCheckedRef = useRef(false);

  const checkForUpdates = useCallback(async () => {
    const api = await getUpdaterApi();
    if (!api) return; // Not in Tauri

    setStatus("checking");
    setError(null);

    try {
      const update = await api.check();

      if (update) {
        setUpdateInfo({
          version: update.version,
          date: update.date,
          body: update.body,
        });
        setStatus("available");
        updateRef.current = update;

        // Notify user about available update
        notify("Update Available", `Version ${update.version} is available`);
      } else {
        setStatus("idle");
        setUpdateInfo(null);
        updateRef.current = null;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to check for updates";
      setError(message);
      setStatus("error");
      console.error("[Updater] Check failed:", err);
    }
  }, [notify]);

  const downloadAndInstall = useCallback(async () => {
    if (!updateRef.current) {
      setError("No update available");
      return;
    }

    setStatus("downloading");
    setProgress(0);
    setError(null);

    try {
      // Track total size and downloaded bytes
      let totalSize = 0;
      let downloadedBytes = 0;

      // Download with progress tracking
      await updateRef.current.downloadAndInstall(
        (event: {
          event: string;
          data: { contentLength?: number | null; chunkLength: number };
        }) => {
          switch (event.event) {
            case "Started":
              totalSize = event.data.contentLength ?? 0;
              downloadedBytes = 0;
              setProgress(0);
              break;
            case "Progress":
              downloadedBytes += event.data.chunkLength;
              if (totalSize > 0) {
                const percent = Math.round((downloadedBytes / totalSize) * 100);
                setProgress(Math.min(percent, 99)); // Cap at 99 until Finished
              }
              break;
            case "Finished":
              setProgress(100);
              break;
          }
        },
      );

      setStatus("ready");
      notify("Update Ready", "Restart to apply the update");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to download update";
      setError(message);
      setStatus("error");
      console.error("[Updater] Download failed:", err);
    }
  }, [notify]);

  const restartApp = useCallback(async () => {
    const api = await getUpdaterApi();
    if (!api) return; // Not in Tauri

    try {
      await api.relaunch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restart app";
      setError(message);
      console.error("[Updater] Restart failed:", err);
    }
  }, []);

  // Auto-check on mount if enabled
  useEffect(() => {
    if (checkOnMount && !hasCheckedRef.current) {
      hasCheckedRef.current = true;
      // Delay check to let app settle
      const timeoutId = setTimeout(checkForUpdates, 3000);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [checkOnMount, checkForUpdates]);

  return {
    status,
    updateInfo,
    progress,
    error,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
    autoCheckEnabled: autoCheckUpdates,
    setAutoCheckEnabled: setAutoCheckUpdates,
  };
}
