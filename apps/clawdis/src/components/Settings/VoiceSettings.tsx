/**
 * Voice Settings Tab
 * TTS voice, PTT key configuration
 */

import { useSettingsStore } from "../../stores/settings";

const VOICE_OPTIONS = [
  { value: "default", label: "System Default" },
  { value: "samantha", label: "Samantha" },
  { value: "alex", label: "Alex" },
  { value: "victoria", label: "Victoria" },
];

const PTT_KEY_OPTIONS = [
  { value: "Space", label: "Space" },
  { value: "Control", label: "Control" },
  { value: "Option", label: "Option" },
  { value: "Shift", label: "Shift" },
];

export function VoiceSettings() {
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const setTtsEnabled = useSettingsStore((s) => s.setTtsEnabled);
  const ttsVoice = useSettingsStore((s) => s.ttsVoice);
  const setTtsVoice = useSettingsStore((s) => s.setTtsVoice);
  const pttKey = useSettingsStore((s) => s.pttKey);
  const setPttKey = useSettingsStore((s) => s.setPttKey);

  return (
    <div className="settings-tab-content">
      <section className="settings-section">
        <h3>Text to Speech</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Enable TTS</span>
            <span className="settings-item-description">
              Read responses aloud using text-to-speech
            </span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">Voice</span>
            <span className="settings-item-description">
              Select the TTS voice
            </span>
          </div>
          <select
            className="settings-select"
            value={ttsVoice}
            onChange={(e) => setTtsVoice(e.target.value)}
            disabled={!ttsEnabled}
          >
            {VOICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>Push to Talk</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <span className="settings-item-title">PTT Key</span>
            <span className="settings-item-description">
              Hold this key to record voice input
            </span>
          </div>
          <select
            className="settings-select"
            value={pttKey}
            onChange={(e) => setPttKey(e.target.value)}
          >
            {PTT_KEY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}
