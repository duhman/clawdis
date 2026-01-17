/**
 * Chat Container Component
 * Renders message list and connection status
 */

import { useGatewayStore } from "../../stores/gateway";
import { MessageList } from "./MessageList";
import { ConnectionStatus } from "./ConnectionStatus";
import "./Chat.css";

export function ChatContainer() {
  const messages = useGatewayStore((state) => state.messages);
  const status = useGatewayStore((state) => state.status);
  const error = useGatewayStore((state) => state.error);

  return (
    <div className="chat-container">
      <ConnectionStatus status={status} error={error} />
      <div className="chat-messages">
        <MessageList messages={messages} />
      </div>
    </div>
  );
}
