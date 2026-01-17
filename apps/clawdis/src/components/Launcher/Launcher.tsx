/**
 * Launcher Component
 * Quick command palette for Clawdis
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  type Command,
  type CommandMatch,
  searchCommands,
} from "../../lib/launcher";
import "./Launcher.css";

// Lazy helper for hiding window
async function hideCurrentWindow(): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.hide();
  } catch (err) {
    console.error("Failed to hide window:", err);
  }
}

export interface LauncherProps {
  commands?: Command[];
  onClose?: () => void;
  onCommand?: (command: Command) => void;
}

export function Launcher({ commands = [], onClose, onCommand }: LauncherProps) {
  const [input, setInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands based on input
  const matches = useMemo(
    () => searchCommands(commands, input),
    [commands, input],
  );

  // Reset selection when matches change
  useEffect(() => {
    setSelectedIndex(0);
  }, [matches]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle closing
  const handleClose = useCallback(async () => {
    if (onClose) {
      onClose();
    } else {
      await hideCurrentWindow();
    }
  }, [onClose]);

  // Handle command execution
  const executeCommand = useCallback(
    async (command: Command) => {
      setInput("");
      onCommand?.(command);
      await command.action();
      await handleClose();
    },
    [onCommand, handleClose],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          await handleClose();
          break;

        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < matches.length - 1 ? prev + 1 : prev,
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case "Enter":
          e.preventDefault();
          if (matches[selectedIndex]) {
            await executeCommand(matches[selectedIndex].command);
          }
          break;
      }
    },
    [handleClose, matches, selectedIndex, executeCommand],
  );

  return (
    <div className="launcher">
      <div className="launcher-container">
        <div className="launcher-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="launcher-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            autoFocus
          />
        </div>

        {matches.length > 0 && (
          <div className="launcher-results">
            {matches.map((match, index) => (
              <CommandItem
                key={match.command.id}
                match={match}
                isSelected={index === selectedIndex}
                onClick={() => executeCommand(match.command)}
              />
            ))}
          </div>
        )}

        {input && matches.length === 0 && (
          <div className="launcher-no-results">No matching commands</div>
        )}

        <div className="launcher-hint">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> select
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

interface CommandItemProps {
  match: CommandMatch;
  isSelected: boolean;
  onClick: () => void;
}

function CommandItem({ match, isSelected, onClick }: CommandItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

  return (
    <div
      ref={ref}
      className={`launcher-command ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      {match.command.icon && (
        <span className="launcher-command-icon">{match.command.icon}</span>
      )}
      <div className="launcher-command-content">
        <div className="launcher-command-name">{match.command.name}</div>
        <div className="launcher-command-description">
          {match.command.description}
        </div>
      </div>
    </div>
  );
}
