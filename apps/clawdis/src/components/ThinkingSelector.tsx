/**
 * Thinking Level Selector Component
 * Allows users to select the AI thinking depth
 */

import "./ThinkingSelector.css";

export type ThinkingLevel = "none" | "low" | "medium" | "high" | "max";

interface ThinkingSelectorProps {
  value: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
}

const THINKING_LEVELS: {
  level: ThinkingLevel;
  label: string;
  description: string;
}[] = [
  { level: "none", label: "None", description: "Quick response" },
  { level: "low", label: "Low", description: "Brief analysis" },
  { level: "medium", label: "Medium", description: "Balanced" },
  { level: "high", label: "High", description: "Deep analysis" },
  { level: "max", label: "Max", description: "Comprehensive" },
];

export function ThinkingSelector({ value, onChange }: ThinkingSelectorProps) {
  return (
    <div className="thinking-selector">
      <label className="thinking-label">Thinking</label>
      <div className="thinking-options">
        {THINKING_LEVELS.map(({ level, label, description }) => (
          <button
            key={level}
            type="button"
            className={`thinking-option ${value === level ? "active" : ""}`}
            onClick={() => onChange(level)}
            title={description}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
