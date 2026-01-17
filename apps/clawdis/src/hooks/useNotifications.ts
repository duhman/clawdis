/**
 * Notifications Hook
 * Handles notification permissions and sending notifications
 */

import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "../stores/settings";

// Lazy-load notification functions only when in Tauri
type NotificationApi = {
  isPermissionGranted: () => Promise<boolean>;
  requestPermission: () => Promise<"granted" | "denied" | "default">;
  sendNotification: (options: { title: string; body?: string }) => void;
};

let notificationApi: NotificationApi | null = null;

async function getNotificationApi(): Promise<NotificationApi | null> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    return null;
  }

  if (!notificationApi) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      notificationApi = {
        isPermissionGranted: mod.isPermissionGranted,
        requestPermission: mod.requestPermission,
        sendNotification: mod.sendNotification,
      };
    } catch (err) {
      console.error("[notifications] Failed to load Tauri plugin:", err);
      return null;
    }
  }
  return notificationApi;
}

export interface UseNotificationsOptions {
  /** Whether to automatically request permission on mount */
  autoRequest?: boolean;
}

export interface UseNotificationsReturn {
  /** Whether notifications are enabled in settings */
  enabled: boolean;
  /** Whether notification permission is granted */
  hasPermission: boolean;
  /** Whether permission request is in progress */
  isRequesting: boolean;
  /** Request notification permission */
  requestNotificationPermission: () => Promise<boolean>;
  /** Send a notification */
  notify: (title: string, body?: string) => Promise<void>;
  /** Toggle notifications enabled */
  setEnabled: (enabled: boolean) => void;
}

export function useNotifications(
  options: UseNotificationsOptions = {},
): UseNotificationsReturn {
  const { autoRequest = false } = options;

  const [hasPermission, setHasPermission] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const enabled = useSettingsStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore(
    (state) => state.setNotificationsEnabled,
  );

  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const api = await getNotificationApi();
      if (!api) return; // Not in Tauri

      try {
        const granted = await api.isPermissionGranted();
        setHasPermission(granted);

        // Auto-request if enabled and not granted
        if (autoRequest && !granted && enabled) {
          const result = await api.requestPermission();
          setHasPermission(result === "granted");
        }
      } catch (err) {
        console.error("Failed to check notification permission:", err);
      }
    };

    checkPermission();
  }, [autoRequest, enabled]);

  const requestNotificationPermission =
    useCallback(async (): Promise<boolean> => {
      if (hasPermission) return true;

      const api = await getNotificationApi();
      if (!api) return false; // Not in Tauri

      setIsRequesting(true);
      try {
        const result = await api.requestPermission();
        const granted = result === "granted";
        setHasPermission(granted);
        return granted;
      } catch (err) {
        console.error("Failed to request notification permission:", err);
        return false;
      } finally {
        setIsRequesting(false);
      }
    }, [hasPermission]);

  const notify = useCallback(
    async (title: string, body?: string): Promise<void> => {
      // Don't send if notifications are disabled
      if (!enabled) return;

      const api = await getNotificationApi();
      if (!api) return; // Not in Tauri

      // Check/request permission if needed
      if (!hasPermission) {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }

      try {
        await api.sendNotification({
          title,
          body,
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
      }
    },
    [enabled, hasPermission, requestNotificationPermission],
  );

  const setEnabled = useCallback(
    (value: boolean) => {
      setNotificationsEnabled(value);
    },
    [setNotificationsEnabled],
  );

  return {
    enabled,
    hasPermission,
    isRequesting,
    requestNotificationPermission,
    notify,
    setEnabled,
  };
}
