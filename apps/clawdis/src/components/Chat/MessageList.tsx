/**
 * Message List Component
 * Renders a list of chat messages with tool invocations
 */

import type { ChatMessage } from "../../stores/gateway";
import { ToolInvocation } from "./ToolInvocation";

interface MessageListProps {
  messages: ChatMessage[];
  onToolApprove?: (toolCallId: string) => void;
  onToolReject?: (toolCallId: string) => void;
}

export function MessageList({
  messages,
  onToolApprove,
  onToolReject,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="message-list-empty">
        <p>No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message message-${message.role}${message.isStreaming ? " streaming" : ""}`}
        >
          <div className="message-role">{message.role}</div>
          <div className="message-content">{message.content}</div>

          {/* Render tool invocations if present */}
          {message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="message-tools">
              {message.toolInvocations.map((invocation) => (
                <ToolInvocation
                  key={invocation.toolCallId}
                  invocation={invocation}
                  onApprove={onToolApprove}
                  onReject={onToolReject}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
