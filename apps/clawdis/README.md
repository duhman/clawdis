# Clawdis

A native macOS AI assistant built with Tauri v2, React, and TypeScript. Clawdis connects to the Clawdbot Gateway to provide a seamless AI chat experience with semantic search, a quick launcher, voice input, and Raycast integration.

## Features

| Feature                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| **Chat Interface**     | Real-time streaming chat with thinking level control |
| **Semantic Search**    | LanceDB-powered vector + full-text hybrid search     |
| **Quick Launcher**     | Global hotkey (Cmd+Shift+Space) for instant access   |
| **Voice Input**        | Push-to-talk with Web Speech API transcription       |
| **Text-to-Speech**     | Native TTS for response playback                     |
| **Raycast Extension**  | Quick actions from Raycast                           |
| **Session Management** | Multiple chat sessions with history                  |

## Architecture

```
┌───────────────────┐        WebSocket         ┌───────────────────┐
│  Clawdis (Tauri)  │ ◄────────────────────►  │ Clawdbot Gateway  │
│  React + Rust     │   ws://127.0.0.1:18789  │   Protocol v3     │
└───────────────────┘                          └───────────────────┘
        │
        ├── Vercel AI SDK (streaming)
        ├── LanceDB (local vector search)
        ├── Web Speech API (voice input)
        └── Global shortcuts (Tauri plugin)
```

## Prerequisites

- **Node.js** 22+
- **pnpm** 9+
- **Rust** (latest stable)
- **Clawdbot Gateway** running on `ws://127.0.0.1:18789`

## Installation

### From DMG (Recommended)

1. Download the latest `Clawdis_x.x.x_aarch64.dmg` from releases
2. Open the DMG and drag Clawdis to Applications
3. Launch Clawdis from Applications

### From Source

```bash
# Clone and navigate
cd apps/clawdis

# Install dependencies
pnpm install

# Development mode
pnpm tauri dev

# Production build
pnpm tauri build

# Install the built app
cp -r src-tauri/target/release/bundle/macos/Clawdis.app /Applications/
```

## Usage

### Chat

1. Launch Clawdis
2. Ensure Clawdbot Gateway is running
3. Type a message and press Enter to send
4. Use the thinking level selector to control response depth:
   - **Off**: Quick responses
   - **Low**: Brief analysis
   - **Medium**: Moderate reasoning
   - **High**: Deep thinking

### Quick Launcher

Press **Cmd+Shift+Space** to open the launcher from anywhere. Type to search commands:

| Command             | Description              |
| ------------------- | ------------------------ |
| `/chat`             | Open main chat window    |
| `/search`           | Open semantic search     |
| `/settings`         | Open settings            |
| `gateway:status`    | Check gateway connection |
| `gateway:reconnect` | Reconnect to gateway     |

### Semantic Search

Search your conversation history using natural language:

1. Click the search icon or use `/search`
2. Type your query
3. Results are ranked by semantic similarity (vector) and keyword match (FTS)
4. Click a result to copy or insert into chat

Search supports three modes:

- **Vector**: Semantic similarity search
- **FTS**: Full-text keyword search
- **Hybrid**: Combined ranking using Reciprocal Rank Fusion

### Voice Input

1. Hold **Space** (push-to-talk) to start recording
2. Speak your message
3. Release to transcribe and send
4. Response can be played back via TTS

Requirements:

- Microphone permission (prompted on first use)
- Web Speech API support (built into WebKit)

### Raycast Extension

Install the Raycast extension for quick access:

```bash
cd extensions/raycast
npm install
npm run dev
```

Commands available in Raycast:

- **Send Message**: Quick message to Clawdbot
- **Search History**: Search conversation history
- **Sessions**: View and switch chat sessions

## Project Structure

```
apps/clawdis/
├── src/                      # React frontend
│   ├── components/
│   │   ├── Chat/             # Chat UI components
│   │   ├── Launcher/         # Quick launcher
│   │   ├── Search/           # Search panel
│   │   └── Voice/            # Voice indicator
│   ├── hooks/                # React hooks
│   │   ├── useGateway.ts     # Gateway connection
│   │   ├── useGatewayChat.ts # Chat with streaming
│   │   ├── useSearch.ts      # Semantic search
│   │   ├── useGlobalShortcut.ts
│   │   ├── useLauncherWindow.ts
│   │   ├── useAudioCapture.ts
│   │   ├── useVoiceTrigger.ts
│   │   ├── useGatewayVoice.ts
│   │   └── useTTS.ts
│   ├── lib/
│   │   ├── gateway/          # WebSocket client
│   │   ├── ai/               # Vercel AI SDK transport
│   │   ├── search/           # LanceDB + indexing
│   │   ├── launcher/         # Command system
│   │   └── voice/            # Audio capture + TTS
│   └── stores/               # Zustand state
├── src-tauri/                # Rust backend
│   ├── src/
│   │   └── lib.rs            # Tauri commands
│   ├── tauri.conf.json       # Tauri config
│   ├── capabilities/         # Permissions
│   └── Info.plist            # macOS permissions
├── extensions/
│   └── raycast/              # Raycast extension
└── package.json
```

## Development

### Commands

```bash
# Start development server
pnpm tauri dev

# Type check
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint

# Build for production
pnpm tauri build
```

### Testing

Tests use Vitest with React Testing Library:

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Watch mode
pnpm test -- --watch
```

### Adding New Features

1. **New Hook**: Add to `src/hooks/` and export from `index.ts`
2. **New Component**: Add to appropriate `src/components/` subdirectory
3. **New Gateway Method**: Add types to `src/lib/gateway/protocol.ts`
4. **New Command**: Add to `src/lib/launcher/built-in-commands.ts` or `gateway-commands.ts`

## Configuration

### Gateway URL

The default gateway URL is `ws://127.0.0.1:18789`. To change:

1. Edit `src/hooks/useGateway.ts` default options
2. Or set via environment variable (coming soon)

### Tauri Permissions

Permissions are defined in `src-tauri/capabilities/default.json`:

- `global-shortcut:*` - Global hotkey registration
- `shell:allow-spawn` - Process spawning
- `core:window:*` - Window management

### macOS Permissions

Defined in `src-tauri/Info.plist`:

- `NSMicrophoneUsageDescription` - Microphone access for voice input

## Troubleshooting

### Gateway Connection Failed

1. Ensure Clawdbot Gateway is running
2. Check the gateway URL matches your configuration
3. Verify no firewall is blocking WebSocket connections

### Voice Input Not Working

1. Grant microphone permission when prompted
2. Check System Preferences > Privacy & Security > Microphone
3. Ensure Web Speech API is supported (macOS 10.15+)

### Quick Launcher Not Responding

1. Check if another app is using Cmd+Shift+Space
2. Grant accessibility permissions if prompted
3. Restart Clawdis

### Search Not Finding Results

1. Ensure documents have been indexed
2. Try different search modes (vector vs FTS vs hybrid)
3. Check LanceDB database exists in app data directory

## Tech Stack

| Layer     | Technology                    |
| --------- | ----------------------------- |
| Framework | Tauri v2                      |
| Frontend  | React 18, TypeScript          |
| Build     | Vite 7                        |
| State     | Zustand                       |
| AI        | Vercel AI SDK                 |
| Search    | LanceDB (vector + FTS)        |
| Voice     | Web Speech API                |
| Styling   | CSS Modules                   |
| Testing   | Vitest, React Testing Library |

## License

MIT

## Related

- [Clawdbot](https://github.com/clawdbot/clawdbot) - The AI assistant gateway
- [Tauri](https://tauri.app) - Desktop app framework
- [LanceDB](https://lancedb.com) - Vector database
