/**
 * Presence Reporting Hook
 * Reports app presence to gateway with unique instance identity
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGatewayStore } from "../stores/gateway";
import { useSettingsStore } from "../stores/settings";

export interface PresenceData {
  /** Unique instance ID (persisted) */
  instanceId: string;
  /** Device/machine name */
  deviceName: string;
  /** App version */
  version: string;
  /** Platform */
  platform: string;
  /** Connection timestamp */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
}

export interface UsePresenceOptions {
  /** Presence refresh interval in ms (default: 180000 = 3 minutes) */
  refreshInterval?: number;
  /** Whether presence reporting is enabled */
  enabled?: boolean;
}

export interface UsePresenceReturn {
  /** Current presence data */
  presence: PresenceData | null;
  /** Whether presence is being reported */
  isReporting: boolean;
  /** Manually trigger presence report */
  reportPresence: () => Promise<void>;
  /** Update last activity timestamp */
  updateActivity: () => void;
}

const DEFAULT_REFRESH_INTERVAL = 180000; // 3 minutes
const INSTANCE_ID_KEY = "clawdis-instance-id";

/**
 * Generate a unique instance ID
 */
function generateInstanceId(): string {
  return `clawdis-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get or create a persisted instance ID
 */
function getInstanceId(): string {
  const stored = localStorage.getItem(INSTANCE_ID_KEY);
  if (stored) return stored;

  const newId = generateInstanceId();
  localStorage.setItem(INSTANCE_ID_KEY, newId);
  return newId;
}

/**
 * Get device name from navigator or hostname
 */
function getDeviceName(): string {
  // Try to get a meaningful name
  const userAgent = navigator.userAgent;

  if (userAgent.includes("Mac")) {
    return "macOS";
  } else if (userAgent.includes("Windows")) {
    return "Windows";
  } else if (userAgent.includes("Linux")) {
    return "Linux";
  }

  return "Unknown Device";
}

/**
 * Get platform info
 */
function getPlatform(): string {
  const userAgent = navigator.userAgent;

  if (userAgent.includes("Tauri")) {
    return "Tauri Desktop";
  }

  return navigator.platform || "Unknown";
}

export function usePresence(
  options: UsePresenceOptions = {},
): UsePresenceReturn {
  const { refreshInterval = DEFAULT_REFRESH_INTERVAL, enabled = true } =
    options;

  const connectionStatus = useGatewayStore((state) => state.status);
  const isInitialized = useSettingsStore((state) => state.isInitialized);

  const [isReporting, setIsReporting] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const connectedAtRef = useRef<number>(0);
  const reportIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate presence data
  const presence = useMemo<PresenceData | null>(() => {
    if (!isInitialized || connectionStatus !== "connected") {
      return null;
    }

    return {
      instanceId: getInstanceId(),
      deviceName: getDeviceName(),
      version: "0.1.0", // Could be pulled from package.json or tauri
      platform: getPlatform(),
      connectedAt: connectedAtRef.current || Date.now(),
      lastActivity,
    };
  }, [isInitialized, connectionStatus, lastActivity]);

  // Report presence to gateway
  const reportPresence = useCallback(async () => {
    if (!enabled || !presence || connectionStatus !== "connected") {
      return;
    }

    setIsReporting(true);
    try {
      // In a real implementation, this would send presence to the gateway
      // For now, we'll log it and emit a custom event that can be picked up
      console.log("[Presence] Reporting:", presence);

      // Emit a custom event that the gateway hook could listen for
      window.dispatchEvent(
        new CustomEvent("presence-report", { detail: presence }),
      );
    } catch (err) {
      console.error("[Presence] Failed to report:", err);
    } finally {
      setIsReporting(false);
    }
  }, [enabled, presence, connectionStatus]);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Track connection time
  useEffect(() => {
    if (connectionStatus === "connected" && connectedAtRef.current === 0) {
      connectedAtRef.current = Date.now();
    } else if (connectionStatus === "disconnected") {
      connectedAtRef.current = 0;
    }
  }, [connectionStatus]);

  // Report presence on connect and set up refresh interval
  useEffect(() => {
    if (!enabled) return;

    if (connectionStatus === "connected") {
      // Report immediately on connect
      reportPresence();

      // Set up refresh interval
      reportIntervalRef.current = setInterval(reportPresence, refreshInterval);
    }

    return () => {
      if (reportIntervalRef.current) {
        clearInterval(reportIntervalRef.current);
        reportIntervalRef.current = null;
      }
    };
  }, [connectionStatus, enabled, refreshInterval, reportPresence]);

  // Track user activity (mouse, keyboard)
  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => {
      updateActivity();
    };

    // Throttle activity updates
    let lastUpdate = 0;
    const throttledActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 30000) {
        // Update at most every 30s
        lastUpdate = now;
        handleActivity();
      }
    };

    window.addEventListener("mousemove", throttledActivity);
    window.addEventListener("keydown", throttledActivity);
    window.addEventListener("click", throttledActivity);

    return () => {
      window.removeEventListener("mousemove", throttledActivity);
      window.removeEventListener("keydown", throttledActivity);
      window.removeEventListener("click", throttledActivity);
    };
  }, [enabled, updateActivity]);

  return {
    presence,
    isReporting,
    reportPresence,
    updateActivity,
  };
}
