/**
 * Health Monitoring Hook
 * Periodically checks gateway health and tracks latency
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useGatewayStore } from "../stores/gateway";
import { useNotifications } from "./useNotifications";

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface HealthState {
  /** Current health status */
  status: HealthStatus;
  /** Last successful health check timestamp */
  lastCheck: number | null;
  /** Round-trip latency in ms */
  latency: number | null;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Error message if unhealthy */
  error: string | null;
}

export interface UseHealthOptions {
  /** Health check interval in ms (default: 60000 = 60s) */
  interval?: number;
  /** Whether to show notifications on health changes */
  notifyOnDegraded?: boolean;
  /** Latency threshold for degraded status in ms (default: 1000) */
  degradedThreshold?: number;
  /** Number of failures before marking unhealthy (default: 3) */
  failureThreshold?: number;
}

export interface UseHealthReturn extends HealthState {
  /** Manually trigger a health check */
  checkHealth: () => Promise<void>;
  /** Whether a health check is in progress */
  isChecking: boolean;
}

const DEFAULT_INTERVAL = 60000; // 60 seconds
const DEFAULT_DEGRADED_THRESHOLD = 1000; // 1 second
const DEFAULT_FAILURE_THRESHOLD = 3;

export function useHealth(options: UseHealthOptions = {}): UseHealthReturn {
  const {
    interval = DEFAULT_INTERVAL,
    notifyOnDegraded = true,
    degradedThreshold = DEFAULT_DEGRADED_THRESHOLD,
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  } = options;

  const [health, setHealth] = useState<HealthState>({
    status: "unknown",
    lastCheck: null,
    latency: null,
    consecutiveFailures: 0,
    error: null,
  });
  const [isChecking, setIsChecking] = useState(false);

  const connectionStatus = useGatewayStore((state) => state.status);
  const { notify } = useNotifications();
  const previousStatusRef = useRef<HealthStatus>("unknown");

  const checkHealth = useCallback(async () => {
    // Don't check if not connected
    if (connectionStatus !== "connected") {
      setHealth((prev) => ({
        ...prev,
        status: connectionStatus === "connecting" ? "unknown" : "unhealthy",
        error: connectionStatus === "disconnected" ? "Not connected" : null,
      }));
      return;
    }

    setIsChecking(true);
    const startTime = performance.now();

    try {
      // Simple ping to check if gateway is responsive
      // In a real implementation, this would call a health endpoint
      // For now, we'll simulate by checking connection status
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      let status: HealthStatus = "healthy";
      if (latency > degradedThreshold) {
        status = "degraded";
      }

      setHealth({
        status,
        lastCheck: Date.now(),
        latency,
        consecutiveFailures: 0,
        error: null,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Health check failed";
      setHealth((prev) => {
        const failures = prev.consecutiveFailures + 1;
        const status: HealthStatus =
          failures >= failureThreshold ? "unhealthy" : "degraded";
        return {
          ...prev,
          status,
          lastCheck: Date.now(),
          latency: null,
          consecutiveFailures: failures,
          error,
        };
      });
    } finally {
      setIsChecking(false);
    }
  }, [connectionStatus, degradedThreshold, failureThreshold]);

  // Notify on health status changes
  useEffect(() => {
    if (
      notifyOnDegraded &&
      health.status !== previousStatusRef.current &&
      health.status !== "unknown"
    ) {
      if (
        health.status === "degraded" &&
        previousStatusRef.current === "healthy"
      ) {
        notify("Gateway Health", "Connection is degraded");
      } else if (
        health.status === "unhealthy" &&
        previousStatusRef.current !== "unhealthy"
      ) {
        notify("Gateway Health", "Connection is unhealthy");
      } else if (
        health.status === "healthy" &&
        previousStatusRef.current !== "healthy" &&
        previousStatusRef.current !== "unknown"
      ) {
        notify("Gateway Health", "Connection restored");
      }
    }
    previousStatusRef.current = health.status;
  }, [health.status, notifyOnDegraded, notify]);

  // Set up periodic health checks
  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up interval
    const intervalId = setInterval(checkHealth, interval);

    return () => clearInterval(intervalId);
  }, [checkHealth, interval]);

  // Update health based on connection status
  useEffect(() => {
    if (connectionStatus === "disconnected") {
      setHealth((prev) => ({
        ...prev,
        status: "unhealthy",
        error: "Disconnected",
      }));
    } else if (connectionStatus === "error") {
      setHealth((prev) => ({
        ...prev,
        status: "unhealthy",
        error: "Connection error",
      }));
    } else if (connectionStatus === "connecting") {
      setHealth((prev) => ({
        ...prev,
        status: "unknown",
        error: null,
      }));
    }
  }, [connectionStatus]);

  return {
    ...health,
    checkHealth,
    isChecking,
  };
}
