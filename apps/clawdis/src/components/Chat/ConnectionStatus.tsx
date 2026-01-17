/**
 * Connection Status Component
 * Shows gateway connection status
 */

import type { ConnectionStatus as Status } from "../../stores/gateway";

interface ConnectionStatusProps {
  status: Status;
  error: string | null;
}

const statusLabels: Record<Status, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  connected: "Connected",
  error: "Error",
};

const statusColors: Record<Status, string> = {
  disconnected: "#888",
  connecting: "#f90",
  connected: "#0c0",
  error: "#f00",
};

export function ConnectionStatus({ status, error }: ConnectionStatusProps) {
  return (
    <div className="connection-status">
      <span
        className="status-indicator"
        style={{ backgroundColor: statusColors[status] }}
      />
      <span className="status-label">{statusLabels[status]}</span>
      {error && <span className="status-error">{error}</span>}
    </div>
  );
}
