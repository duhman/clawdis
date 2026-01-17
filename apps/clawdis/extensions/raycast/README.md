# Clawdis Raycast Extension

A Raycast extension for interacting with Clawdbot Gateway. Send messages, search conversation history, and manage sessions directly from Raycast.

## Features

| Command            | Description                                       |
| ------------------ | ------------------------------------------------- |
| **Send Message**   | Send a message to Clawdbot and see the response   |
| **Search History** | Semantic search through your conversation history |
| **Sessions**       | View, select, and manage chat sessions            |

## Prerequisites

- [Raycast](https://raycast.com) installed
- [Clawdbot Gateway](https://github.com/clawdbot/clawdbot) running on `ws://127.0.0.1:18789`

## Installation

### Development Mode

```bash
# Navigate to extension directory
cd extensions/raycast

# Install dependencies
npm install

# Start development mode
npm run dev
```

This will open Raycast with the extension loaded for development.

### Production Build

```bash
# Build for distribution
npm run build
```

## Configuration

Configure the extension in Raycast Preferences:

| Setting             | Default                | Description                        |
| ------------------- | ---------------------- | ---------------------------------- |
| **Gateway URL**     | `ws://127.0.0.1:18789` | WebSocket URL for Clawdbot Gateway |
| **Default Session** | `raycast`              | Session key to use for messages    |

## Commands

### Send Message

Send a message to Clawdbot and receive a response.

1. Open Raycast
2. Type "Send Message" or use the shortcut
3. Enter your message in the form
4. Press Enter to send
5. Response appears as a toast notification

**Options:**

- Thinking level: `low` (hardcoded for quick responses)
- Streaming: Disabled (waits for complete response)

### Search History

Search through your conversation history using semantic search.

1. Open Raycast
2. Type "Search History"
3. Start typing your query
4. Results appear with relevance scores
5. Press Enter to copy a result to clipboard

**Features:**

- Debounced search (300ms delay)
- Shows message role (You/Clawdbot)
- Displays match percentage
- Copy to clipboard action

### Sessions

View and manage your chat sessions.

1. Open Raycast
2. Type "Sessions"
3. Browse available sessions
4. Actions:
   - **Select Session**: Set as active session
   - **Delete Session**: Remove session
   - **Refresh**: Reload session list

**Display:**

- Session title or key
- Message count
- Last activity timestamp

## Architecture

```
extensions/raycast/
├── src/
│   ├── gateway.ts         # WebSocket client
│   ├── send-message.tsx   # Send message command
│   ├── search-history.tsx # Search command
│   └── sessions.tsx       # Session management
├── package.json           # Extension manifest
└── tsconfig.json          # TypeScript config
```

### Gateway Client

The extension uses a simplified WebSocket client (`gateway.ts`) that:

- Connects to Clawdbot Gateway on demand
- Sends JSON-RPC style requests
- Handles responses with 30-second timeout
- Auto-reconnects on connection loss

```typescript
// Usage example
import { request, getSessionKey } from "./gateway";

const response = await request<ChatResponse>("chat.send", {
  message: "Hello",
  sessionKey: getSessionKey(),
  thinking: "low",
  stream: false,
});
```

## Gateway Protocol

The extension communicates using Clawdbot Gateway Protocol v3:

### Request Frame

```json
{
  "type": "request",
  "id": "raycast-1234567890-1",
  "method": "chat.send",
  "params": {
    "message": "Hello",
    "sessionKey": "raycast"
  }
}
```

### Response Frame

```json
{
  "type": "response",
  "id": "raycast-1234567890-1",
  "result": {
    "content": "Hello! How can I help?",
    "messageId": "abc123"
  }
}
```

### Methods Used

| Method           | Purpose                     |
| ---------------- | --------------------------- |
| `chat.send`      | Send a message              |
| `search.query`   | Search conversation history |
| `session.list`   | List all sessions           |
| `session.delete` | Delete a session            |

## Development

### Scripts

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### Adding a New Command

1. Create a new `.tsx` file in `src/`
2. Export a default React component
3. Add command to `package.json`:

```json
{
  "commands": [
    {
      "name": "my-command",
      "title": "My Command",
      "description": "Does something useful",
      "mode": "view"
    }
  ]
}
```

### Testing

Manual testing in Raycast:

1. Run `npm run dev`
2. Open Raycast
3. Search for your command
4. Test functionality

## Troubleshooting

### "Failed to connect to gateway"

1. Ensure Clawdbot Gateway is running
2. Check Gateway URL in preferences
3. Verify no firewall blocking WebSocket

### "Request timeout"

1. Gateway may be overloaded
2. Check network connectivity
3. Try increasing timeout in `gateway.ts`

### Extension not appearing

1. Restart Raycast
2. Re-run `npm run dev`
3. Check for TypeScript errors

## Dependencies

| Package        | Version   | Purpose               |
| -------------- | --------- | --------------------- |
| `@raycast/api` | ^1.72.0   | Raycast extension API |
| `ws`           | (bundled) | WebSocket client      |

## License

MIT
