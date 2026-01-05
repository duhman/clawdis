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
| `src/infra/` | Infrastructure (bridge, presence, sessions, mcp, hooks) |
| `src/infra/mcp/` | MCP client and server registry |
| `src/infra/hooks/` | Agent lifecycle hook runner |
| `src/agents/` | Pi agent integration, tools, configs |
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

### MCP Server Integration

Clawdis supports Model Context Protocol (MCP) servers for external tool integrations.

| File | Purpose |
|------|---------|
| `src/infra/mcp/client.ts` | JSON-RPC over stdio client |
| `src/infra/mcp/registry.ts` | Server lifecycle (on-demand spawn, caching, shutdown) |
| `src/agents/mcp-tools.ts` | MCP → AgentTool adapter |

**Configuration** (`~/.clawdis/clawdis.json`):
```json
{
  "mcp": {
    "enabled": true,
    "servers": {
      "exa": {
        "command": "uvx",
        "args": ["mcp-exa"],
        "env": { "EXA_API_KEY": "..." }
      }
    }
  }
}
```

MCP tools appear as `mcp__<server>__<tool>` (e.g., `mcp__exa__web_search`).

### Agent Hooks

Lifecycle hooks for observability and validation at various points in agent execution.

| Hook | Timing | Can Block |
|------|--------|-----------|
| `PreToolUse` | Before tool execution | Yes (non-zero exit) |
| `PostToolUse` | After tool execution | No |
| `PostAgentTurn` | After agent turn completes | No |
| `SessionEnd` | When session ends | No |

**Configuration** (`~/.clawdis/clawdis.json`):
```json
{
  "agentHooks": {
    "enabled": true,
    "PreToolUse": [
      {
        "matcher": "bash",
        "type": "command",
        "command": "scripts/validate-bash.sh",
        "timeoutMs": 5000
      }
    ]
  }
}
```

Hooks receive context via environment variables: `HOOK_TOOL_NAME`, `HOOK_TOOL_ARGS`, `HOOK_SESSION_KEY`.

### Subagent Delegation

The `spawn_agent` tool creates isolated agent sessions for specific task types.

| Agent Type | Purpose |
|------------|---------|
| `explore` | Codebase analysis, information gathering |
| `plan` | Implementation planning, architecture design |
| `code-review` | Code quality, bugs, best practices |
| `research` | Web/documentation research |
| `test` | Run tests, analyze results |

Subagents run in isolated contexts with their own session files (cleaned up automatically).

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

### VPS Gateway Deployment (Recommended)

Deploy the gateway to an always-on VPS for 24/7 availability across all devices.

**Current Production Setup** (srv1209224.hstgr.cloud):

| Component | Value |
|-----------|-------|
| Dashboard | `https://srv1209224.tail7248b9.ts.net/` (Tailscale Serve) |
| VPS IP | `62.72.20.190` (public) |
| Tailscale IP | `100.88.241.49` |
| Gateway port | `18789` |
| Token | `bb47aa7622ad277ac8480a562ecc74e84b246d145514c56a` |
| Service | `systemctl status clawdis-gateway` |
| Logs | `journalctl -u clawdis-gateway -f` |
| Config | `/home/clawdis/.clawdis/clawdis.json` |
| Environment | `/home/clawdis/.clawdis/env` |

**VPS Gateway Config** (`/home/clawdis/.clawdis/clawdis.json`):
```json
{
  "gateway": {
    "mode": "local",
    "bind": "tailnet",
    "auth": { "mode": "token", "token": "..." }
  },
  "agent": { "workspace": "/home/clawdis/clawd" },
  "web": { "enabled": true },
  "discord": { "enabled": true }
}
```

**VPS Management Commands**:
```bash
# Status
ssh root@srv1209224.hstgr.cloud "systemctl status clawdis-gateway"

# Logs
ssh root@srv1209224.hstgr.cloud "journalctl -u clawdis-gateway -f"

# Restart
ssh root@srv1209224.hstgr.cloud "systemctl restart clawdis-gateway"

# Update deployment
pnpm build && tar -czvf /tmp/clawdis-deploy.tar.gz dist/ node_modules/ package.json
scp /tmp/clawdis-deploy.tar.gz root@srv1209224.hstgr.cloud:/tmp/
ssh root@srv1209224.hstgr.cloud "cd /opt/clawdis && tar -xzf /tmp/clawdis-deploy.tar.gz && systemctl restart clawdis-gateway"
```

### VPS Workspace & MCP Servers

The VPS agent workspace is at `/home/clawdis/clawd/` with skills synced from local.

**MCP Servers** (configured in VPS clawdis.json):
| Server | Type | Purpose |
|--------|------|---------|
| exa | stdio (npx) | Web search, code context, research |

**Workspace Sync**:
```bash
# Manual sync
./scripts/sync-workspace-to-vps.sh

# Auto sync (runs daily at 6 AM, also on ~/clawd/skills changes)
# Configured via: ~/Library/LaunchAgents/com.clawdis.workspace-sync.plist
launchctl list | grep clawdis.workspace-sync
```

**What gets synced**:
- `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `USER.md`, `IDENTITY.md`
- `skills/` (diary, persistent-memory, capture-learning, feedback)
- `canvas/`
- Symlinks are resolved to actual content

### Client Configuration (bigmac/minimac)

For Macs connecting to the VPS gateway:

**CLI Config** (`~/.clawdis/clawdis.json`):
```json
{
  "gateway": {
    "mode": "remote",
    "remote": {
      "url": "ws://100.88.241.49:18789",
      "token": "bb47aa7622ad277ac8480a562ecc74e84b246d145514c56a"
    }
  }
}
```

**macOS App**: The app's "Remote over SSH" mode expects SSH tunneling. For direct Tailscale access:
1. Set app to "Not configured" mode (don't run local gateway)
2. Access dashboard via Tailscale Serve: `https://srv1209224.tail7248b9.ts.net/`
3. CLI commands work via the config above

**Environment Variable** (for CLI):
```bash
launchctl setenv CLAWDIS_GATEWAY_TOKEN "bb47aa7622ad277ac8480a562ecc74e84b246d145514c56a"
```

### Legacy: Remote Gateway with SSH Tunnel

For SSH-tunnel based remote access (when not using VPS):

1. **Gateway host (e.g., minimac)**:
   - Gateway running with `gateway.auth.token` in config
   - `gateway.bind: "lan"` or `"tailnet"` (not `"loopback"`)
   - Note the token value from `~/.clawdis/clawdis.json`

2. **Client Mac**:
   - SSH key in agent: `ssh-add --apple-use-keychain ~/.ssh/id_ed25519`
   - SSH key authorized on remote: `ssh-copy-id <user>@<host>`
   - `CLAWDIS_GATEWAY_TOKEN` env var set: `launchctl setenv CLAWDIS_GATEWAY_TOKEN "<token>"`
   - Restart app after setting env var (Cmd+Q, reopen)

### Remote Gateway Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Permission denied (publickey)` | Wrong SSH username | Check `whoami` on remote - usernames may differ! |
| `Permission denied` after adding key | Wrong permissions on remote | `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys` |
| `Permission denied` with key in agent | Key not in remote's authorized_keys | `ssh-copy-id <user>@<host>` (will prompt for password) |
| `unauthorized` at WebSocket | Token mismatch | Set `CLAWDIS_GATEWAY_TOKEN` env var to match gateway's token |
| `unauthorized` after setting token | App not restarted | Quit (Cmd+Q) and relaunch - GUI apps need restart for env vars |
| Connection refused at 127.0.0.1 | SSH tunnel not establishing | Check SSH target username and identity file path in app settings |
| Intermittent DNS failures | mDNS unreliable | Use Tailscale IP (e.g., `100.x.x.x`) instead of `.local` hostname |

### Remote Mode: Complete Setup Example

```bash
# 1. On CLIENT: Add SSH key to agent
ssh-add --apple-use-keychain ~/.ssh/id_ed25519

# 2. On CLIENT: Copy key to gateway (will prompt for password)
ssh-copy-id minimac@100.94.223.25  # Use Tailscale IP!

# 3. On CLIENT: Verify SSH works
ssh minimac@100.94.223.25 echo ok

# 4. On CLIENT: Get token from gateway
ssh minimac@100.94.223.25 "grep token ~/.clawdis/clawdis.json"

# 5. On CLIENT: Set token for GUI app
launchctl setenv CLAWDIS_GATEWAY_TOKEN "bb47aa7622ad277ac8480a562ecc74e84b246d145514c56a"

# 6. Restart Clawdis app (Cmd+Q, reopen)

# 7. In app settings:
#    - SSH: minimac@100.94.223.25 (correct user + Tailscale IP)
#    - Identity file: /Users/bigmac/.ssh/id_ed25519 (your actual path)
```
