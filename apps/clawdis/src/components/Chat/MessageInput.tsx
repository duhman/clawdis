/**
 * Message Input Component
 * Input field for sending chat messages with abort support
 */

import { useState, useCallback, type FormEvent } from "react";
import { useGatewayStore } from "../../stores/gateway";

interface MessageInputProps {
  onSend: (message: string) => void;
  onAbort?: () => void;
}

export function MessageInput({ onSend, onAbort }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const status = useGatewayStore((state) => state.status);
  const isGenerating = useGatewayStore((state) => state.isGenerating);

  const isDisabled = status !== "connected";
  const canSend = !isDisabled && !isGenerating && message.trim().length > 0;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = message.trim();
      if (!trimmed || !canSend) return;

      onSend(trimmed);
      setMessage("");
    },
    [message, canSend, onSend],
  );

  const handleAbort = useCallback(() => {
    onAbort?.();
  }, [onAbort]);

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="message-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          status !== "connected"
            ? "Connect to start chatting..."
            : isGenerating
              ? "Waiting for response..."
              : "Type a message..."
        }
        disabled={isDisabled || isGenerating}
      />
      {isGenerating ? (
        <button
          type="button"
          className="message-abort-button"
          onClick={handleAbort}
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          className="message-send-button"
          disabled={!canSend}
        >
          Send
        </button>
      )}
    </form>
  );
}
