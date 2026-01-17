/**
 * General Settings Tab
 * Launch at login, dock icon, gateway URL, notifications
 */

import { useSettingsStore } from "../../stores/settings";
import { useNotifications } from "../../hooks/useNotifications";

export function GeneralSettings() {
  const launchAtLogin = useSettingsStore((s) => s.launchAtLogin);
  const setLaunchAtLogin = useSettingsStore((s) => s.setLaunchAtLogin);
  const showDockIcon = useSettingsStore((s) => s.showDockIcon);
  const setShowDockIcon = useSettingsStore((s) => s.setShowDockIcon);
  const gatewayUrl = useSettingsStore((s) => s.gatewayUrl);
  const setGatewayUrl = useSettingsStore((s) => s.setGatewayUrl);

  const {
    enabled: notificationsEnabled,
    hasPermission,
    isRequesting,
    setEnabled: setNotificationsEnabled,
    requestNotificationPermission,
  } = useNotifications();

  return (
    <div className="settings-tab-content">
      <section className="settings-section">
        <h3>Startup</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Launch at login</span>
            <span className="settings-item-description">
              Start Clawdis automatically when you log in
            </span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={launchAtLogin}
              onChange={(e) => setLaunchAtLogin(e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Show in Dock</span>
            <span className="settings-item-description">
              Display Clawdis icon in the Dock
            </span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={showDockIcon}
              onChange={(e) => setShowDockIcon(e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h3>Gateway</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Gateway URL</span>
            <span className="settings-item-description">
              WebSocket URL for the Clawdbot gateway
            </span>
          </div>
          <input
            type="text"
            className="settings-input"
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            placeholder="ws://127.0.0.1:18789"
          />
        </div>
      </section>

      <section className="settings-section">
        <h3>Notifications</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Enable notifications</span>
            <span className="settings-item-description">
              Show notifications when responses complete
            </span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        {notificationsEnabled && !hasPermission && (
          <div className="settings-item">
            <div className="settings-item-label">
              <span className="settings-item-title">Permission required</span>
              <span className="settings-item-description">
                Grant notification permission to receive alerts
              </span>
            </div>
            <button
              className="settings-button"
              onClick={requestNotificationPermission}
              disabled={isRequesting}
            >
              {isRequesting ? "Requesting..." : "Grant Permission"}
            </button>
          </div>
        )}

        {notificationsEnabled && hasPermission && (
          <div className="settings-item">
            <div className="settings-item-label">
              <span className="settings-item-title">Permission status</span>
              <span className="settings-item-description">
                Notifications are enabled
              </span>
            </div>
            <span className="settings-status settings-status--success">
              Granted
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
