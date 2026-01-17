import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { request, getSessionKey } from "./gateway";

interface ChatResponse {
  content: string;
  messageId: string;
}

export default function SendMessage() {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { pop } = useNavigation();

  async function handleSubmit() {
    if (!message.trim()) {
      showToast({
        style: Toast.Style.Failure,
        title: "Message required",
        message: "Please enter a message to send",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await request<ChatResponse>("chat.send", {
        message: message.trim(),
        sessionKey: getSessionKey(),
        thinking: "low",
        stream: false,
      });

      showToast({
        style: Toast.Style.Success,
        title: "Message sent",
        message: response.content.slice(0, 100),
      });

      pop();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to send",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Message" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="message"
        title="Message"
        placeholder="Type your message to Clawdbot..."
        value={message}
        onChange={setMessage}
        autoFocus
      />
    </Form>
  );
}
