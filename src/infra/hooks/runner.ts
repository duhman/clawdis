/**
 * Agent Lifecycle Hook Runner
 *
 * Executes hooks at various points in the agent lifecycle:
 * - PreToolUse: Before tool execution (can block)
 * - PostToolUse: After tool execution
 * - PostAgentTurn: After each agent turn
 * - SessionEnd: When session ends
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

import type {
  AgentHookDefinition,
  AgentHooksConfig,
} from "../../config/config.js";

const execAsync = promisify(exec);

// ─── Types ────────────────────────────────────────────────────────────────────

export type HookEventType =
  | "PreToolUse"
  | "PostToolUse"
  | "PostAgentTurn"
  | "SessionEnd";

export type HookContext = {
  /** Tool name being executed (for tool hooks) */
  toolName?: string;
  /** Tool arguments (for tool hooks) */
  toolArgs?: Record<string, unknown>;
  /** Tool result (for PostToolUse) */
  toolResult?: unknown;
  /** Session key */
  sessionKey?: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
};

export type HookResult = {
  /** Whether the hook succeeded */
  success: boolean;
  /** Whether to block the operation (PreToolUse only) */
  block?: boolean;
  /** Message explaining the result */
  message?: string;
  /** stdout from command execution */
  stdout?: string;
  /** stderr from command execution */
  stderr?: string;
  /** Exit code for command hooks */
  exitCode?: number;
};

// ─── Glob Matching ────────────────────────────────────────────────────────────

/**
 * Simple glob matcher for tool names.
 * Supports:
 * - `*` matches any characters
 * - `?` matches single character
 * - Literal strings for exact match
 */
function matchesGlob(pattern: string, value: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
    .replace(/\*/g, ".*") // * matches anything
    .replace(/\?/g, "."); // ? matches single char

  const regex = new RegExp(`^${regexPattern}$`, "i");
  return regex.test(value);
}

// ─── Hook Execution ───────────────────────────────────────────────────────────

/**
 * Execute a single hook definition.
 */
async function executeHook(
  hook: AgentHookDefinition,
  context: HookContext,
): Promise<HookResult> {
  const timeoutMs = hook.timeoutMs ?? 5000;

  if (hook.type === "command" && hook.command) {
    return executeCommandHook(hook.command, context, timeoutMs);
  }

  if (hook.type === "skill" && hook.skill) {
    return executeSkillHook(hook.skill, context, timeoutMs);
  }

  return {
    success: false,
    message: `Invalid hook definition: missing command or skill`,
  };
}

/**
 * Execute a shell command hook.
 */
async function executeCommandHook(
  command: string,
  context: HookContext,
  timeoutMs: number,
): Promise<HookResult> {
  try {
    // Set up environment with context
    const env = {
      ...process.env,
      HOOK_TOOL_NAME: context.toolName ?? "",
      HOOK_TOOL_ARGS: JSON.stringify(context.toolArgs ?? {}),
      HOOK_SESSION_KEY: context.sessionKey ?? "",
      HOOK_METADATA: JSON.stringify(context.metadata ?? {}),
    };

    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      env,
      shell: "/bin/bash",
    });

    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (err) {
    const error = err as {
      code?: number;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    // Timeout
    if (error.killed) {
      return {
        success: false,
        block: true,
        message: `Hook timed out after ${timeoutMs}ms`,
        exitCode: -1,
      };
    }

    // Non-zero exit code - treat as block signal for PreToolUse
    const exitCode = typeof error.code === "number" ? error.code : 1;
    return {
      success: false,
      block: exitCode !== 0,
      message: error.stderr || error.message || "Hook failed",
      stdout: error.stdout?.trim(),
      stderr: error.stderr?.trim(),
      exitCode,
    };
  }
}

/**
 * Execute a skill hook (placeholder - skills run via agent).
 */
async function executeSkillHook(
  skillName: string,
  _context: HookContext,
  _timeoutMs: number,
): Promise<HookResult> {
  // Skills are invoked by the agent, not directly by hooks
  // This would require spawning a mini agent or using a skill loader
  // For now, log and continue
  console.log(
    `[Hooks] Skill hook "${skillName}" - skill hooks not yet implemented`,
  );

  return {
    success: true,
    message: `Skill hook "${skillName}" acknowledged (skill execution not implemented)`,
  };
}

// ─── Hook Runner ──────────────────────────────────────────────────────────────

export class HookRunner {
  private config: AgentHooksConfig;

  constructor(config: AgentHooksConfig) {
    this.config = config;
  }

  /**
   * Check if hooks are enabled.
   */
  get isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Run hooks for a specific event type.
   * Returns aggregated results from all matching hooks.
   */
  async runHooks(
    event: HookEventType,
    context: HookContext,
  ): Promise<HookResult[]> {
    if (!this.isEnabled) {
      return [];
    }

    const hooks = this.config[event] ?? [];
    const matchingHooks = hooks.filter((hook) =>
      this.matchesContext(hook, context),
    );

    const results: HookResult[] = [];

    for (const hook of matchingHooks) {
      const result = await executeHook(hook, context);
      results.push(result);

      // For PreToolUse, stop on first blocking result
      if (event === "PreToolUse" && result.block) {
        break;
      }
    }

    return results;
  }

  /**
   * Run PreToolUse hooks and check if tool should be blocked.
   */
  async checkPreToolUse(
    toolName: string,
    toolArgs: Record<string, unknown>,
    sessionKey?: string,
  ): Promise<{ allowed: boolean; blockReason?: string }> {
    const results = await this.runHooks("PreToolUse", {
      toolName,
      toolArgs,
      sessionKey,
    });

    const blockingResult = results.find((r) => r.block);
    if (blockingResult) {
      return {
        allowed: false,
        blockReason: blockingResult.message || "Blocked by hook",
      };
    }

    return { allowed: true };
  }

  /**
   * Run PostToolUse hooks.
   */
  async runPostToolUse(
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolResult: unknown,
    sessionKey?: string,
  ): Promise<void> {
    await this.runHooks("PostToolUse", {
      toolName,
      toolArgs,
      toolResult,
      sessionKey,
    });
  }

  /**
   * Run PostAgentTurn hooks.
   */
  async runPostAgentTurn(sessionKey?: string): Promise<void> {
    await this.runHooks("PostAgentTurn", { sessionKey });
  }

  /**
   * Run SessionEnd hooks.
   */
  async runSessionEnd(sessionKey?: string): Promise<void> {
    await this.runHooks("SessionEnd", { sessionKey });
  }

  /**
   * Check if a hook matches the current context.
   */
  private matchesContext(
    hook: AgentHookDefinition,
    context: HookContext,
  ): boolean {
    // If no matcher specified, match all
    if (!hook.matcher) {
      return true;
    }

    // If tool name provided, check against matcher
    if (context.toolName) {
      return matchesGlob(hook.matcher, context.toolName);
    }

    return true;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a HookRunner from config, or null if hooks are disabled.
 */
export function createHookRunner(config?: AgentHooksConfig): HookRunner | null {
  if (!config || config.enabled === false) {
    return null;
  }

  return new HookRunner(config);
}
