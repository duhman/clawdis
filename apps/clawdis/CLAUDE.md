# CLAUDE.md - Clawdis App

Project-specific guidance for Claude Code when working on the Clawdis Tauri app.

## Project Overview

Clawdis is a native macOS AI assistant built with Tauri v2, React, and TypeScript. It connects to the Clawdbot Gateway to provide chat, semantic search, quick launcher, and voice capabilities.

## Tech Stack

| Layer          | Technology                    |
| -------------- | ----------------------------- |
| Framework      | Tauri v2                      |
| Frontend       | React 18, TypeScript, Vite 7  |
| State          | Zustand                       |
| AI Integration | Vercel AI SDK                 |
| Search         | LanceDB (vector + FTS)        |
| Voice          | Web Speech API                |
| Testing        | Vitest, React Testing Library |

## Key Directories

```
src/
├── components/          # React UI components
│   ├── Chat/            # ChatContainer, MessageInput, MessageList
│   ├── Launcher/        # Quick launcher palette
│   ├── Search/          # SearchPanel, SearchResult
│   └── Voice/           # VoiceIndicator
├── hooks/               # React hooks (useGateway, useSearch, etc.)
├── lib/
│   ├── gateway/         # WebSocket client + protocol types
│   ├── ai/              # Vercel AI SDK transport
│   ├── search/          # LanceDB + indexing
│   ├── launcher/        # Command system
│   └── voice/           # Audio capture + TTS
├── stores/              # Zustand state stores
└── test/                # Test setup

src-tauri/
├── src/lib.rs           # Rust commands
├── tauri.conf.json      # Tauri configuration
├── capabilities/        # Permission definitions
└── Info.plist           # macOS permissions

extensions/raycast/      # Raycast extension
```

## Commands

```bash
# Development
pnpm tauri dev          # Start dev server + Tauri
pnpm dev                # Vite dev only (no Tauri)

# Quality
pnpm typecheck          # TypeScript check
pnpm test               # Run Vitest tests
pnpm lint               # Run linter

# Build
pnpm build              # Build frontend
pnpm tauri build        # Build full app + DMG
```

## Coding Patterns

### Adding a New Hook

1. Create in `src/hooks/useMyHook.ts`
2. Export types and hook function
3. Add to `src/hooks/index.ts`

```typescript
// src/hooks/useMyHook.ts
export interface UseMyHookOptions {
  // options
}

export interface UseMyHookReturn {
  // return values
}

export function useMyHook(options: UseMyHookOptions = {}): UseMyHookReturn {
  // implementation
}
```

### Adding a New Component

1. Create directory in appropriate `src/components/` subdirectory
2. Create `Component.tsx` and `Component.css`
3. Add `index.ts` for exports

```typescript
// src/components/MyFeature/index.ts
export { MyComponent } from "./MyComponent";
export type { MyComponentProps } from "./MyComponent";
```

### Gateway Protocol

Requests follow JSON-RPC style:

```typescript
// Send request
const response = await client.request<ResponseType>("method.name", {
  param1: value1,
  sessionKey: "default",
});
```

Common methods:

- `chat.send` - Send message
- `chat.history` - Get history
- `search.query` - Semantic search
- `session.list` - List sessions
- `talk.mode` - Toggle voice mode

### Search Implementation

Uses hybrid search combining vector similarity and full-text:

```typescript
const indexer = new DocumentIndexer({ dbPath, useMockEmbeddings: false });
await indexer.indexDocument(id, content, metadata);
const results = await indexer.searchHybrid(query, limit);
```

### Voice Pipeline

Push-to-talk with Web Speech API transcription:

```typescript
const { isListening, transcript, start, stop } = useGatewayVoice({
  client,
  sessionKey: "default",
  onTranscript: (text) => console.log("Transcribed:", text),
  onResponse: (text) => console.log("Response:", text),
});
```

## Testing

Tests colocated with source files:

```bash
src/
├── lib/gateway/client.ts
├── lib/gateway/client.test.ts      # Unit tests here
├── components/Chat/MessageInput.tsx
└── components/Chat/MessageInput.test.tsx
```

Use React Testing Library patterns:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageInput } from "./MessageInput";

test("submits message on enter", () => {
  const onSend = vi.fn();
  render(<MessageInput onSend={onSend} />);
  // ...
});
```

## Tauri Configuration

### Adding Permissions

Edit `src-tauri/capabilities/default.json`:

```json
{
  "permissions": ["new:permission-name"]
}
```

### macOS Permissions

Edit `src-tauri/Info.plist` for system permissions:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Description for user</string>
```

## Common Tasks

### Update Gateway Protocol Types

1. Check `src/gateway/protocol/schema/frames.ts` in main clawdis repo
2. Update `src/lib/gateway/protocol.ts` to match
3. Run `pnpm typecheck` to verify

### Add New Launcher Command

1. Built-in: Edit `src/lib/launcher/built-in-commands.ts`
2. Gateway: Edit `src/lib/launcher/gateway-commands.ts`
3. Register in `src/lib/launcher/index.ts`

### Modify Search Behavior

- Vector search: `src/lib/search/lance-db.ts`
- Indexing: `src/lib/search/indexer.ts`
- Hook: `src/hooks/useSearch.ts`

## Troubleshooting

### Tauri Build Fails

1. Check Rust is installed: `rustc --version`
2. Verify Xcode CLT: `xcode-select --install`
3. Clear cache: `cargo clean` in `src-tauri/`

### Type Errors in Gateway

Gateway types must match protocol. Check:

- `src/lib/gateway/protocol.ts` - Client types
- Compare with main Clawdis `src/gateway/protocol/`

### Tests Failing

1. Run `pnpm typecheck` first
2. Check test setup: `src/test/setup.ts`
3. Mock browser APIs as needed (Web Speech, etc.)

## Related Files

| File                           | Purpose                    |
| ------------------------------ | -------------------------- |
| `docs/ARCHITECTURE.md`         | Detailed architecture docs |
| `extensions/raycast/README.md` | Raycast extension docs     |
| `../../../CLAUDE.md`           | Parent project guidance    |

## Notes

- Gateway URL default: `ws://127.0.0.1:18789`
- LanceDB stores data in `~/.clawdis/search.lance`
- Voice requires macOS 10.15+ for Web Speech API
- Global shortcut: Cmd+Shift+Space for launcher
