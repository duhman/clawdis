/**
 * Config module barrel - re-exports from modular files.
 *
 * This file provides backward compatibility for imports from "./config/config.js"
 * while the actual implementation is split across:
 * - types.ts: Type definitions
 * - paths.ts: Path resolution functions
 * - io.ts: File I/O operations
 * - defaults.ts: Default value application
 * - validation.ts: Config validation
 * - zod-schema.ts: Zod schemas
 */

// ─── Re-export all types ───────────────────────────────────────────────────────
export * from "./types.js";

// ─── Re-export paths ───────────────────────────────────────────────────────────
export {
  isNixMode,
  resolveIsNixMode,
  resolveStateDir,
  STATE_DIR_CLAWDBOT,
  resolveConfigPath,
  CONFIG_PATH_CLAWDBOT,
  DEFAULT_GATEWAY_PORT,
  resolveOAuthDir,
  resolveOAuthPath,
  resolveGatewayPort,
} from "./paths.js";

// ─── Re-export I/O functions ───────────────────────────────────────────────────
export {
  parseConfigJson5,
  createConfigIO,
  loadConfig,
  readConfigFileSnapshot,
  writeConfigFile,
} from "./io.js";

// ─── Re-export validation ──────────────────────────────────────────────────────
export { validateConfigObject } from "./validation.js";

// ─── Re-export defaults ────────────────────────────────────────────────────────
export {
  applyIdentityDefaults,
  applyTalkApiKey,
  applyModelAliasDefaults,
  applySessionDefaults,
} from "./defaults.js";

// ─── Re-export legacy migration ────────────────────────────────────────────────
export { migrateLegacyConfig } from "./legacy-migrate.js";

// ─── Re-export Zod schema ──────────────────────────────────────────────────────
export { ClawdbotSchema } from "./zod-schema.js";

// ─── "Clawdis" naming aliases (for local fork compatibility) ───────────────────
// The upstream renamed the project to "clawdbot", but this fork keeps "clawdis".
// These aliases allow existing code using "clawdis" naming to continue working.

import type { ClawdbotConfig } from "./types.js";
import { STATE_DIR_CLAWDBOT, CONFIG_PATH_CLAWDBOT } from "./paths.js";

/** @deprecated Use ClawdbotConfig - alias for local fork compatibility */
export type ClawdisConfig = ClawdbotConfig;

/** @deprecated Use STATE_DIR_CLAWDBOT - alias for local fork compatibility */
export const STATE_DIR_CLAWDIS = STATE_DIR_CLAWDBOT;

/** @deprecated Use CONFIG_PATH_CLAWDBOT - alias for local fork compatibility */
export const CONFIG_PATH_CLAWDIS = CONFIG_PATH_CLAWDBOT;

/** Zod schema alias */
export { ClawdbotSchema as ClawdisSchema } from "./zod-schema.js";
