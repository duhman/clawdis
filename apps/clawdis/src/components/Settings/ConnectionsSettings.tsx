/**
 * Connections Settings Tab
 * Gateway status, health monitoring, reconnect button
 */

import { useCallback } from "react";
import { useGatewayStore } from "../../stores/gateway";
import { useSettingsStore } from "../../stores/settings";
import { useHealth, type HealthStatus } from "../../hooks/useHealth";

export function ConnectionsSettings() {
  const status = useGatewayStore((s) => s.status);
  const serverInfo = useGatewayStore((s) => s.serverInfo);
  const error = useGatewayStore((s) => s.error);
  const gatewayUrl = useSettingsStore((s) => s.gatewayUrl);
  const {
    status: healthStatus,
    latency,
    lastCheck,
    consecutiveFailures,
    checkHealth,
    isChecking,
  } = useHealth();

  const handleReconnect = useCallback(() => {
    // Trigger reconnect by dispatching a custom event
    // The useGateway hook will handle the actual reconnection
    window.dispatchEvent(new CustomEvent("gateway-reconnect"));
  }, []);

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "disconnected":
        return "Disconnected";
      case "error":
        return error ?? "Connection Error";
    }
  };

  const getHealthStatusClass = (healthStatus: HealthStatus): string => {
    switch (healthStatus) {
      case "healthy":
        return "settings-status--success";
      case "degraded":
        return "settings-status--warning";
      case "unhealthy":
        return "settings-status--error";
      default:
        return "";
    }
  };

  const formatLastCheck = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className="settings-tab-content">
      <section className="settings-section">
        <h3>Gateway Connection</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Status</span>
            <span className="settings-item-description">{gatewayUrl}</span>
          </div>
          <div className="status-indicator">
            <span className={`status-dot ${status}`} />
            <span>{getStatusText()}</span>
          </div>
        </div>

        {serverInfo && (
          <>
            <div className="settings-item">
              <div className="settings-item-label">
                <span className="settings-item-title">Server Version</span>
              </div>
              <span className="settings-item-value">
                {serverInfo.version}
                {serverInfo.commit && ` (${serverInfo.commit.slice(0, 7)})`}
              </span>
            </div>

            <div className="settings-item">
              <div className="settings-item-label">
                <span className="settings-item-title">Connection ID</span>
              </div>
              <span className="settings-item-value">{serverInfo.connId}</span>
            </div>
          </>
        )}

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Manual Reconnect</span>
            <span className="settings-item-description">
              Force reconnection to the gateway
            </span>
          </div>
          <button
            className="settings-button"
            onClick={handleReconnect}
            disabled={status === "connecting"}
          >
            {status === "connecting" ? "Connecting..." : "Reconnect"}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h3>Health Monitoring</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Health Status</span>
            <span className="settings-item-description">
              Last checked: {formatLastCheck(lastCheck)}
            </span>
          </div>
          <span
            className={`settings-status ${getHealthStatusClass(healthStatus)}`}
          >
            {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
          </span>
        </div>

        {latency !== null && (
          <div className="settings-item">
            <div className="settings-item-label">
              <span className="settings-item-title">Latency</span>
              <span className="settings-item-description">
                Round-trip time to gateway
              </span>
            </div>
            <span className="settings-item-value">{latency}ms</span>
          </div>
        )}

        {consecutiveFailures > 0 && (
          <div className="settings-item">
            <div className="settings-item-label">
              <span className="settings-item-title">Consecutive Failures</span>
              <span className="settings-item-description">
                Number of failed health checks
              </span>
            </div>
            <span className="settings-status settings-status--error">
              {consecutiveFailures}
            </span>
          </div>
        )}

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Manual Health Check</span>
            <span className="settings-item-description">
              Check gateway health now
            </span>
          </div>
          <button
            className="settings-button"
            onClick={checkHealth}
            disabled={isChecking}
          >
            {isChecking ? "Checking..." : "Check Now"}
          </button>
        </div>
      </section>
    </div>
  );
}
