/**
 * About Settings Tab
 * Version info, check for updates
 */

import { useUpdater } from "../../hooks";

// Version from package.json (will be replaced at build time)
const APP_VERSION = "0.1.0";

export function AboutSettings() {
  const {
    status,
    updateInfo,
    progress,
    error,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
    autoCheckEnabled,
    setAutoCheckEnabled,
  } = useUpdater({ checkOnMount: false });

  const getStatusText = () => {
    switch (status) {
      case "checking":
        return "Checking for updates...";
      case "available":
        return `Version ${updateInfo?.version} available`;
      case "downloading":
        return `Downloading... ${progress}%`;
      case "ready":
        return "Update ready - restart to apply";
      case "error":
        return error || "Update check failed";
      default:
        return null;
    }
  };

  const getButtonConfig = () => {
    switch (status) {
      case "checking":
        return {
          text: "Checking...",
          disabled: true,
          onClick: checkForUpdates,
        };
      case "available":
        return {
          text: "Download & Install",
          disabled: false,
          onClick: downloadAndInstall,
        };
      case "downloading":
        return {
          text: `${progress}%`,
          disabled: true,
          onClick: downloadAndInstall,
        };
      case "ready":
        return { text: "Restart Now", disabled: false, onClick: restartApp };
      default:
        return { text: "Check Now", disabled: false, onClick: checkForUpdates };
    }
  };

  const buttonConfig = getButtonConfig();
  const statusText = getStatusText();

  return (
    <div className="settings-tab-content">
      <section className="settings-section">
        <div className="about-info">
          <h2>Clawdis</h2>
          <p className="about-version">Version {APP_VERSION}</p>
        </div>

        <div className="about-links">
          <a
            href="https://github.com/clawdbot/clawdbot"
            target="_blank"
            rel="noopener noreferrer"
            className="about-link"
          >
            GitHub
          </a>
          <a
            href="https://docs.clawd.bot"
            target="_blank"
            rel="noopener noreferrer"
            className="about-link"
          >
            Documentation
          </a>
        </div>
      </section>

      <section className="settings-section">
        <h3>Updates</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Check for updates</span>
            {statusText && (
              <span
                className={`settings-item-description${status === "error" ? " settings-error" : ""}`}
              >
                {statusText}
              </span>
            )}
          </div>
          <button
            className="settings-button settings-button-primary"
            onClick={buttonConfig.onClick}
            disabled={buttonConfig.disabled}
          >
            {buttonConfig.text}
          </button>
        </div>

        {updateInfo?.body && status === "available" && (
          <div className="settings-item">
            <div className="settings-item-label">
              <span className="settings-item-title">Release Notes</span>
              <span className="settings-item-description settings-release-notes">
                {updateInfo.body}
              </span>
            </div>
          </div>
        )}

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Automatic updates</span>
            <span className="settings-item-description">
              Check for updates on startup
            </span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={autoCheckEnabled}
              onChange={(e) => setAutoCheckEnabled(e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h3>Legal</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Open Source Licenses</span>
            <span className="settings-item-description">
              View licenses for open source components
            </span>
          </div>
          <button className="settings-button">View Licenses</button>
        </div>
      </section>
    </div>
  );
}
