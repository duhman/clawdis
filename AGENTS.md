# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Clawdis?

A personal AI assistant platform with multi-surface messaging (WhatsApp, Telegram, Discord, iMessage), voice wake, and a Canvas UI. The Gateway is the control plane; companion apps (macOS, iOS, Android) connect as nodes.

## Build & Development

```bash
pnpm install           # Install deps
pnpm build             # TypeScript build (tsc)
pnpm clawdis ...       # Run CLI in dev mode (tsx)
pnpm gateway:watch     # Auto-reload gateway on TS changes
```

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm clawdis gateway --port 18789` | Start gateway |
| `pnpm clawdis login` | Link WhatsApp |
| `pnpm clawdis send --to +1234 --message "Hi"` | Send message |
| `pnpm clawdis agent --message "..." --thinking high` | Run agent |
| `pnpm clawdis onboard` | Setup wizard |

### Testing & Quality

```bash
pnpm test              # Vitest (colocated *.test.ts)
pnpm test:coverage     # With V8 coverage (70% thresholds)
pnpm lint              # Biome check + oxlint
pnpm lint:fix          # Auto-fix lint issues
pnpm format            # Biome format
```

### Protocol & A2UI

```bash
pnpm protocol:gen         # Generate JSON Schema from TypeBox
pnpm protocol:gen:swift   # Generate Swift models
pnpm canvas:a2ui:bundle   # Regenerate A2UI bundle
```

## Architecture

### Source Layout

| Directory | Purpose |
|-----------|---------|
| `src/gateway/` | WebSocket server (single source of truth) |
| `src/cli/` | Commander-based CLI wiring |
| `src/commands/` | CLI command implementations |
| `src/infra/` | Infrastructure (bridge, presence, sessions) |
| `src/agents/` | Pi agent integration |
| `src/media/` | Media processing pipeline |
| `src/telegram/` | Telegram provider (grammY) |
| `src/discord/` | Discord provider (discord.js) |
| `src/web/` | WhatsApp web provider (Baileys) |
| `apps/macos/` | macOS menubar app (Swift) |
| `apps/ios/` | iOS node app (Swift) |
| `apps/android/` | Android node app |

### Gateway Protocol

- **Transport**: WebSocket on `ws://127.0.0.1:18789`
- **First frame must be `connect`**; AJV validates all frames against TypeBox schemas
- **Methods**: `send`, `agent`, `chat.*`, `sessions.*`, `config.*`, `cron.*`, `node.*`
- **Events**: `agent`, `chat`, `presence`, `tick`, `health`, `heartbeat`, `shutdown`
- **Idempotency keys required** for side-effecting methods (`send`, `agent`)

### Node Bridge

Optional TCP bridge (`src/infra/bridge/`) for iOS/Android nodes:
- Newline-delimited JSON frames
- Pairing flow with tokens
- Capabilities: canvas, screen, camera, voiceWake

## Code Patterns

### Dependency Injection

Use `createDefaultDeps()` pattern for testable components. CLI options follow existing command patterns.

### TypeScript

- ESM modules, strict typing, avoid `any`
- Biome for formatting/linting
- Files ~700 LOC guideline (not hard limit)

### Testing

- Vitest with V8 coverage
- Colocated `*.test.ts` files; e2e as `*.e2e.test.ts`
- Mobile: prefer real devices over simulators

## Commit Workflow

```bash
scripts/committer "<msg>" <file...>   # Scoped commits
```

Avoid manual `git add`/`git commit` to keep staging scoped.

## Configuration

- Config: `~/.clawdis/clawdis.json`
- Credentials: `~/.clawdis/credentials/`
- Sessions: `~/.clawdis/sessions/`
- Workspace: `~/clawd/` (agent skills, AGENTS.md, SOUL.md)

## macOS App

```bash
./scripts/restart-mac.sh    # Build + package + relaunch
./scripts/clawlog.sh        # Query unified logs (subsystem com.steipete.clawdis)
```

SwiftUI: prefer `@Observable`/`@Bindable` (Observation framework) over `ObservableObject`/`@StateObject`.

## Key Documentation

- [`docs/architecture.md`](docs/architecture.md) - Gateway architecture
- [`docs/gateway.md`](docs/gateway.md) - Gateway details
- [`docs/configuration.md`](docs/configuration.md) - Config reference
- [`docs/agent.md`](docs/agent.md) - Agent runtime
- [`docs/RELEASING.md`](docs/RELEASING.md) - Release checklist

## Claude Code Workaround

The Bash tool escapes `!` to `\\!`. Use heredoc for messages with exclamation marks:

```bash
clawdis send --to "+1234" --message "$(cat <<'EOF'
Hello!
EOF
)"
```

## Known Gotchas

### Swift 6.2 Runtime Libraries

SwiftPM builds don't automatically bundle Swift compatibility libraries. When the app fails to launch with `dyld: Library not loaded: @rpath/libswiftCompatibilitySpan.dylib`, the packaging script needs to copy it:

```bash
# Already handled in scripts/package-mac-app.sh
cp /Applications/Xcode.app/.../lib/swift-6.2/macosx/libswiftCompatibilitySpan.dylib \
   "$APP_ROOT/Contents/Frameworks/"
```

When upgrading Swift/Xcode, check for new compatibility libraries.

### Gateway Token: CLI vs App Mismatch

| Component | Token Source |
|-----------|--------------|
| CLI (`clawdis health`) | `~/.clawdis/clawdis.json` → `gateway.remote.token` |
| macOS App | `CLAWDIS_GATEWAY_TOKEN` env var only |

If the app shows "unauthorized" but CLI works, set the env var:

```bash
launchctl setenv CLAWDIS_GATEWAY_TOKEN "your-token"
# Then restart the app
```

For persistence, create `~/Library/LaunchAgents/com.*.clawdis.env.plist` with `RunAtLoad`.

### macOS GUI Apps Don't Inherit Shell Environment

Apps launched from Finder/Spotlight don't see `~/.zshrc` exports. Use:
- `launchctl setenv VAR value` (immediate, current session)
- LaunchAgent with `RunAtLoad` (persistent across reboots)

### Remote Gateway Setup Checklist

1. **Mac Mini (gateway host)**:
   - Gateway running with `gateway.auth.token` in config
   - `gateway.bind: "lan"` or `"tailnet"` (not `"loopback"`)

2. **Client Mac**:
   - SSH key copied to gateway host (`ssh-copy-id user@host`)
   - `CLAWDIS_GATEWAY_TOKEN` env var set (for app)
   - Config has matching token in `gateway.remote.token` (for CLI)
