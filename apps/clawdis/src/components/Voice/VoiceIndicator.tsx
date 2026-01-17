/**
 * VoiceIndicator Component
 * Displays voice activity state with visual feedback
 */

import { type GatewayVoicePhase } from "../../hooks/useGatewayVoice";
import "./VoiceIndicator.css";

export interface VoiceIndicatorProps {
  /** Current voice phase */
  phase: GatewayVoicePhase;
  /** Current recording duration in seconds */
  duration?: number;
  /** Current transcript (while listening) */
  transcript?: string;
  /** Whether to show the indicator */
  visible?: boolean;
  /** Click handler */
  onClick?: () => void;
}

const phaseLabels: Record<GatewayVoicePhase, string> = {
  idle: "Ready",
  listening: "Listening...",
  transcribing: "Transcribing...",
  processing: "Processing...",
  speaking: "Speaking...",
};

const phaseIcons: Record<GatewayVoicePhase, string> = {
  idle: "🎤",
  listening: "🔴",
  transcribing: "💭",
  processing: "⚙️",
  speaking: "🔊",
};

export function VoiceIndicator({
  phase,
  duration = 0,
  transcript = "",
  visible = true,
  onClick,
}: VoiceIndicatorProps) {
  if (!visible) return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`voice-indicator voice-indicator--${phase}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.();
        }
      }}
    >
      <div className="voice-indicator__icon">
        {phaseIcons[phase]}
        {phase === "listening" && <div className="voice-indicator__pulse" />}
      </div>

      <div className="voice-indicator__content">
        <div className="voice-indicator__label">
          {phaseLabels[phase]}
          {phase === "listening" && duration > 0 && (
            <span className="voice-indicator__duration">
              {formatDuration(duration)}
            </span>
          )}
        </div>

        {transcript && phase === "listening" && (
          <div className="voice-indicator__transcript">{transcript}</div>
        )}
      </div>

      {phase === "listening" && (
        <div className="voice-indicator__waveform">
          <div className="voice-indicator__bar" />
          <div className="voice-indicator__bar" />
          <div className="voice-indicator__bar" />
          <div className="voice-indicator__bar" />
          <div className="voice-indicator__bar" />
        </div>
      )}
    </div>
  );
}
