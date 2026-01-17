# Clawdis Architecture

This document describes the technical architecture of Clawdis, a native macOS AI assistant built with Tauri v2.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Clawdis App                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    React Frontend                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │    │
│  │  │   Chat UI   │  │  Launcher   │  │    Search Panel     │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │    │
│  │         │                │                     │             │    │
│  │  ┌──────┴────────────────┴─────────────────────┴──────────┐ │    │
│  │  │                      Hooks Layer                        │ │    │
│  │  │  useGateway │ useGatewayChat │ useSearch │ useVoice    │ │    │
│  │  └──────────────────────────┬──────────────────────────────┘ │    │
│  │                             │                                │    │
│  │  ┌──────────────────────────┴──────────────────────────────┐ │    │
│  │  │                     Library Layer                        │ │    │
│  │  │  Gateway Client │ AI Transport │ LanceDB │ Voice/TTS    │ │    │
│  │  └──────────────────────────┬──────────────────────────────┘ │    │
│  └─────────────────────────────┼────────────────────────────────┘    │
│                                │                                     │
├────────────────────────────────┼─────────────────────────────────────┤
│  ┌─────────────────────────────┴──────────────────────────────────┐  │
│  │                     Tauri Backend (Rust)                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │   Commands   │  │   Plugins    │  │     Permissions      │  │  │
│  │  │              │  │ - Shortcut   │  │ - Microphone         │  │  │
│  │  │              │  │ - Shell      │  │ - Window Create      │  │  │
│  │  │              │  │ - Opener     │  │ - Global Shortcut    │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ WebSocket
                                ▼
                    ┌───────────────────────┐
                    │   Clawdbot Gateway    │
                    │   Protocol v3         │
                    │   ws://127.0.0.1:18789│
                    └───────────────────────┘
```

## Component Architecture

### Frontend (React + TypeScript)

#### Components

| Component          | Purpose                            | Location                   |
| ------------------ | ---------------------------------- | -------------------------- |
| `ChatContainer`    | Main chat view with message list   | `src/components/Chat/`     |
| `MessageInput`     | Text input with send functionality | `src/components/Chat/`     |
| `MessageList`      | Scrollable message display         | `src/components/Chat/`     |
| `ConnectionStatus` | Gateway connection indicator       | `src/components/Chat/`     |
| `ToolInvocation`   | Tool call display with approval    | `src/components/Chat/`     |
| `ThinkingSelector` | Thinking level dropdown            | `src/components/`          |
| `Launcher`         | Quick command palette              | `src/components/Launcher/` |
| `SearchPanel`      | Semantic search interface          | `src/components/Search/`   |
| `SearchResult`     | Individual search result           | `src/components/Search/`   |
| `VoiceIndicator`   | Voice recording status             | `src/components/Voice/`    |

#### Hooks

| Hook                | Purpose                         | Dependencies         |
| ------------------- | ------------------------------- | -------------------- |
| `useGateway`        | WebSocket connection management | `GatewayClient`      |
| `useGatewayChat`    | Chat messages with streaming    | `useGateway`, AI SDK |
| `useSearch`         | Semantic search operations      | `DocumentIndexer`    |
| `useGlobalShortcut` | Register global hotkeys         | Tauri plugin         |
| `useLauncherWindow` | Manage launcher window          | Tauri WebviewWindow  |
| `useQuickAction`    | Execute launcher commands       | `useGateway`         |
| `useAudioCapture`   | Microphone recording            | Web Audio API        |
| `useVoiceTrigger`   | Push-to-talk control            | `useAudioCapture`    |
| `useGatewayVoice`   | Voice-to-gateway integration    | `useVoiceTrigger`    |
| `useTTS`            | Text-to-speech playback         | Web Speech API       |

#### Stores (Zustand)

| Store             | State                      | Purpose                  |
| ----------------- | -------------------------- | ------------------------ |
| `useGatewayStore` | Connection state, messages | Gateway connection state |
| `useRecentStore`  | Recent items list          | Launcher recent items    |

### Library Layer

#### Gateway Client (`src/lib/gateway/`)

```typescript
// Protocol types matching Clawdbot Gateway v3
interface RequestFrame {
  type: "request";
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: "response";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

interface EventFrame {
  type: "event";
  event: string;
  data: unknown;
}
```

**Key Methods:**

- `connect(options)` - Establish WebSocket connection
- `request<T>(method, params)` - Send request, await response
- `subscribe(handler)` - Listen for events
- Auto-reconnect with exponential backoff

#### AI Transport (`src/lib/ai/`)

Custom transport for Vercel AI SDK that routes through the Gateway:

```typescript
// Maps AI SDK operations to gateway protocol
class GatewayTransport {
  async sendMessage(
    message: string,
    options: ChatOptions,
  ): AsyncIterable<StreamPart>;
}
```

#### Search System (`src/lib/search/`)

**Components:**

| File                 | Purpose                               |
| -------------------- | ------------------------------------- |
| `lance-db.ts`        | LanceDB wrapper for vector operations |
| `embeddings.ts`      | Embedding generation (mock or real)   |
| `indexer.ts`         | Document indexing with embeddings     |
| `session-indexer.ts` | Background session history indexing   |

**Search Modes:**

1. **Vector Search**: Cosine similarity on embeddings
2. **Full-Text Search**: Keyword matching with BM25
3. **Hybrid Search**: Combined using Reciprocal Rank Fusion (RRF)

```
RRF Score = Σ 1/(k + rank_i)  where k=60
```

#### Voice System (`src/lib/voice/`)

| File                | Purpose                  |
| ------------------- | ------------------------ |
| `audio-capture.ts`  | MediaRecorder wrapper    |
| `text-to-speech.ts` | Web Speech Synthesis API |

### Backend (Rust/Tauri)

#### Tauri Configuration

```json
// tauri.conf.json
{
  "productName": "Clawdis",
  "identifier": "com.clawdbot.clawdis",
  "bundle": {
    "macOS": {
      "infoPlist": "Info.plist",
      "minimumSystemVersion": "10.15"
    }
  }
}
```

#### Capabilities

```json
// capabilities/default.json
{
  "permissions": [
    "core:default",
    "global-shortcut:allow-register",
    "shell:allow-spawn",
    "core:window:allow-create"
  ]
}
```

#### Plugins Used

| Plugin                         | Purpose             |
| ------------------------------ | ------------------- |
| `tauri-plugin-global-shortcut` | System-wide hotkeys |
| `tauri-plugin-shell`           | Process execution   |
| `tauri-plugin-opener`          | Open URLs/files     |

## Data Flow

### Chat Message Flow

```
User Input → MessageInput → useGatewayChat → GatewayClient
                                                   │
                                                   ▼
                                            WebSocket Send
                                                   │
                                                   ▼
                                           Gateway Server
                                                   │
                                                   ▼
                                            AI Processing
                                                   │
                                                   ▼
                                         Streaming Events
                                                   │
                                                   ▼
                                            WebSocket Receive
                                                   │
                                                   ▼
GatewayClient.onEvent → useGatewayChat → MessageList → UI Update
```

### Search Flow

```
User Query → SearchPanel → useSearch
                              │
                              ▼
                        DocumentIndexer
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Vector Search       FTS Search
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                         RRF Merge
                              │
                              ▼
                       SearchResults
```

### Voice Flow

```
Space Key Down → useVoiceTrigger → AudioRecorder.start()
                                         │
                                         ▼
                                  SpeechRecognition.start()
                                         │
                                         ▼ (continuous)
                                  transcript updates
                                         │
Space Key Up → useVoiceTrigger → AudioRecorder.stop()
                                         │
                                         ▼
                                  Final transcript
                                         │
                                         ▼
                               useGatewayVoice.handleEnd()
                                         │
                                         ▼
                               GatewayClient.request('chat.send')
```

## Extension Points

### Adding New Gateway Methods

1. Add types to `src/lib/gateway/protocol.ts`
2. Use in hooks: `client.request<ResponseType>('method.name', params)`

### Adding New Commands

1. Built-in: Add to `src/lib/launcher/built-in-commands.ts`
2. Gateway: Add to `src/lib/launcher/gateway-commands.ts`
3. Register in `src/lib/launcher/index.ts`

### Adding New Search Content

1. Implement indexer in `src/lib/search/`
2. Call `DocumentIndexer.indexDocument()` with content
3. Embeddings are generated automatically

## Performance Considerations

### WebSocket

- Auto-reconnect with exponential backoff (1s → 32s max)
- Request timeout: 30 seconds
- Heartbeat: Handled by gateway

### Search

- LanceDB uses HNSW index for fast vector search
- FTS uses inverted index with BM25 scoring
- Hybrid search runs both in parallel

### UI

- Messages use React virtualization for long lists
- Streaming updates batch to 16ms frames
- Launcher window is pre-created and hidden

## Security

### Permissions

| Permission      | Reason            |
| --------------- | ----------------- |
| Microphone      | Voice input       |
| Global Shortcut | Launcher hotkey   |
| Window Create   | Launcher window   |
| Shell Spawn     | External commands |

### Data Storage

- LanceDB database: `~/.clawdis/search.lance`
- Session data: Stored in gateway
- Preferences: Zustand persist to localStorage

## Testing Strategy

| Layer       | Tool                  | Coverage               |
| ----------- | --------------------- | ---------------------- |
| Unit        | Vitest                | Hooks, utilities       |
| Component   | React Testing Library | UI components          |
| Integration | Vitest + mock gateway | Full flows             |
| E2E         | (Planned)             | Playwright/WebdriverIO |

## Future Architecture

### Planned Enhancements

1. **Rust-side LanceDB**: Move vector operations to Rust for better performance
2. **Background Indexing**: Service worker for continuous indexing
3. **Plugin System**: User-installable extensions
4. **Multi-window**: Detachable chat panels
5. **Local AI**: Optional local model support via Ollama
