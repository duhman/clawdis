/**
 * Settings Window Component
 * Main settings dialog with tabbed navigation
 */

import type React from "react";
import { useState, useCallback } from "react";
import { GeneralSettings } from "./GeneralSettings";
import { VoiceSettings } from "./VoiceSettings";
import { ConnectionsSettings } from "./ConnectionsSettings";
import { AboutSettings } from "./AboutSettings";
import "./SettingsWindow.css";

export interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "general" | "voice" | "connections" | "about";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "voice", label: "Voice" },
  { id: "connections", label: "Connections" },
  { id: "about", label: "About" },
];

export function SettingsWindow({
  isOpen,
  onClose,
}: SettingsWindowProps): React.ReactNode {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      // Tab navigation with arrow keys
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const currentIndex = TABS.findIndex((t) => t.id === activeTab);
        const direction = e.key === "ArrowLeft" ? -1 : 1;
        const nextIndex =
          (currentIndex + direction + TABS.length) % TABS.length;
        setActiveTab(TABS[nextIndex].id);
        e.preventDefault();
      }
    },
    [activeTab, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="settings-window" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            &times;
          </button>
        </header>

        <nav className="settings-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="settings-content">
          {activeTab === "general" && (
            <div
              role="tabpanel"
              id="general-panel"
              aria-labelledby="general-tab"
            >
              <GeneralSettings />
            </div>
          )}
          {activeTab === "voice" && (
            <div role="tabpanel" id="voice-panel" aria-labelledby="voice-tab">
              <VoiceSettings />
            </div>
          )}
          {activeTab === "connections" && (
            <div
              role="tabpanel"
              id="connections-panel"
              aria-labelledby="connections-tab"
            >
              <ConnectionsSettings />
            </div>
          )}
          {activeTab === "about" && (
            <div role="tabpanel" id="about-panel" aria-labelledby="about-tab">
              <AboutSettings />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
