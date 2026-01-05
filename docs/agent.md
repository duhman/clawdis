---
summary: "Agent runtime (embedded p-mono), workspace contract, and session bootstrap"
read_when:
  - Changing agent runtime, workspace bootstrap, or session behavior
---

<!-- {% raw %} -->

# Agent Runtime 🤖

CLAWDIS runs a single embedded agent runtime derived from **p-mono** (internal name: **p**).

## Workspace (required)

You must set an agent home directory via `agent.workspace`. CLAWDIS uses this as the agent’s **only** working directory (`cwd`) for tools and context.

Recommended: use `clawdis setup` to create `~/.clawdis/clawdis.json` if missing and initialize the workspace files.

## Bootstrap files (injected)

Inside `agent.workspace`, CLAWDIS expects these user-editable files:

- `AGENTS.md` — operating instructions + “memory”
- `SOUL.md` — persona, boundaries, tone
- `TOOLS.md` — user-maintained tool notes (e.g. `imsg`, `sag`, conventions)
- `BOOTSTRAP.md` — one-time first-run ritual (deleted after completion)
- `IDENTITY.md` — agent name/vibe/emoji
- `USER.md` — user profile + preferred address

On the first turn of a new session, CLAWDIS injects the contents of these files directly into the agent context.

If a file is missing, CLAWDIS injects a single “missing file” marker line (and `clawdis setup` will create a safe default template).

## Built-in tools (internal)

p’s embedded core tools (read/bash/edit/write and related internals) are defined in code and always available. `TOOLS.md` does **not** control which tools exist; it’s guidance for how _you_ want them used.

## Skills

Clawdis loads skills from three locations (workspace wins on name conflict):

- Bundled (shipped with the install)
- Managed/local: `~/.clawdis/skills`
- Workspace: `<workspace>/skills`

Skills can be gated by config/env (see `skills` in `docs/configuration.md`).

## p-mono integration

Clawdis reuses pieces of the p-mono codebase (models/tools), but **session management, discovery, and tool wiring are Clawdis-owned**.

- No p-coding agent runtime.
- No `~/.pi/agent` or `<workspace>/.pi` settings are consulted.

## MCP Server Integration

Clawdis supports [Model Context Protocol](https://modelcontextprotocol.io/) servers for external tool integrations. MCP servers are spawned on-demand when their tools are first called.

**Configuration:**

```json
{
  "mcp": {
    "enabled": true,
    "servers": {
      "server-name": {
        "command": "npx",
        "args": ["@example/mcp-server"],
        "env": { "API_KEY": "..." },
        "initTimeoutMs": 30000,
        "callTimeoutMs": 60000
      }
    }
  }
}
```

MCP tools appear with the naming convention `mcp__<server>__<tool>`. For example, if you configure an "exa" server with a `web_search` tool, it becomes `mcp__exa__web_search`.

**Implementation:**

- `src/infra/mcp/client.ts` — JSON-RPC 2.0 client over stdio
- `src/infra/mcp/registry.ts` — Server lifecycle management
- `src/agents/mcp-tools.ts` — MCP → AgentTool adapter

## Agent Hooks

Lifecycle hooks allow observability and validation at various points in agent execution. Hooks can be shell commands or skill invocations.

| Hook            | Timing                     | Can Block                  |
| --------------- | -------------------------- | -------------------------- |
| `PreToolUse`    | Before tool execution      | Yes (non-zero exit blocks) |
| `PostToolUse`   | After tool execution       | No                         |
| `PostAgentTurn` | After agent turn completes | No                         |
| `SessionEnd`    | When session ends          | No                         |

**Configuration:**

```json
{
  "agentHooks": {
    "enabled": true,
    "PreToolUse": [
      {
        "matcher": "bash",
        "type": "command",
        "command": "scripts/validate-command.sh",
        "timeoutMs": 5000
      }
    ],
    "PostAgentTurn": [
      {
        "type": "skill",
        "skill": "diary"
      }
    ]
  }
}
```

**Environment variables** available to command hooks:

- `HOOK_TOOL_NAME` — Name of the tool being executed
- `HOOK_TOOL_ARGS` — JSON-encoded tool arguments
- `HOOK_SESSION_KEY` — Session identifier
- `HOOK_METADATA` — Additional context (JSON)

**Implementation:**

- `src/infra/hooks/runner.ts` — Hook execution with glob matching
- `src/agents/pi-embedded-runner.ts` — Hook integration into agent loop

## Subagent Delegation

The `spawn_agent` tool allows the main agent to delegate tasks to isolated subagents. Each subagent runs in its own session with specialized system prompts.

| Agent Type    | Purpose                                      |
| ------------- | -------------------------------------------- |
| `explore`     | Codebase analysis, information gathering     |
| `plan`        | Implementation planning, architecture design |
| `code-review` | Code quality, bugs, best practices           |
| `research`    | Web/documentation research                   |
| `test`        | Run tests, analyze results                   |

**Usage:**

```json
{
  "name": "spawn_agent",
  "arguments": {
    "agentType": "explore",
    "task": "Find all files that handle authentication",
    "contextFiles": ["src/auth/README.md"],
    "timeoutMs": 120000
  }
}
```

Subagents:

- Run in isolated sessions (no context pollution)
- Have their own temp session files (auto-cleaned)
- Return summarized results to the main agent

**Implementation:**

- `src/agents/agent-configs.ts` — Preset configurations
- `src/agents/clawdis-tools.ts` — `spawn_agent` tool

## Peter @ steipete (only)

Apply these notes **only** when the user is Peter Steinberger at steipete.

- Gateway runs on the **Mac Studio in London**.
- Primary work computer: **MacBook Pro**.
- Peter travels between **Vienna** and **London**; there are two networks bridged via **Tailscale**.
- For debugging, connect to the Mac Studio (London) or MacBook Pro (primary).
- There is also an **M1 MacBook Pro** on the Vienna tailnet you can use to access the Vienna network.
- Nodes can be accessed via the `clawdis` binary (`pnpm clawdis` in `~/Projects/clawdis`).
- See also `skills/clawdis*` for node/browser/canvas/cron usage.

## Sessions

Session transcripts are stored as JSONL at:

- `~/.clawdis/sessions/<SessionId>.jsonl`

The session ID is stable and chosen by CLAWDIS.
Legacy Pi/Tau session folders are **not** read.

## Steering while streaming

Incoming user messages are queued while the agent is streaming. The queue is checked **after each tool call**. If a queued message is present, remaining tool calls from the current assistant message are skipped (error tool results with "Skipped due to queued user message."), then the queued user message is injected before the next assistant response.

## Configuration (minimal)

At minimum, set:

- `agent.workspace`
- `whatsapp.allowFrom` (strongly recommended)

---

_Next: [Group Chats](./group-messages.md)_ 🦞

<!-- {% endraw %} -->
