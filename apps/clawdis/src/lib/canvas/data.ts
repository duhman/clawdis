/**
 * Canvas Data Utilities
 *
 * JSON Pointer path handling, value formatting, and visibility evaluation.
 */

import type {
  VisibilityCondition,
  PathCondition,
  AuthCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  EqCondition,
  GtCondition,
  LtCondition,
  FormatType,
} from "./types";

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Get a value from an object using a JSON Pointer path (e.g., "/metrics/revenue")
 */
export function getValueByPath(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  if (!path || path === "/") return obj;

  const segments = path.startsWith("/")
    ? path.slice(1).split("/")
    : path.split("/");
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Set a value in an object using a JSON Pointer path
 */
export function setValueByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path || path === "/") {
    return value as Record<string, unknown>;
  }

  const result = { ...obj };
  const segments = path.startsWith("/")
    ? path.slice(1).split("/")
    : path.split("/");

  let current = result;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (!(segment in current) || typeof current[segment] !== "object") {
      current[segment] = {};
    } else {
      current[segment] = { ...(current[segment] as Record<string, unknown>) };
    }
    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1];
  current[lastSegment] = value;

  return result;
}

// ============================================================================
// VALUE FORMATTING
// ============================================================================

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

/**
 * Format a value based on the specified format type
 */
export function formatValue(
  value: unknown,
  format: FormatType = "text",
  options?: { prefix?: string; suffix?: string },
): string {
  if (value === null || value === undefined) return "-";

  let formatted: string;

  switch (format) {
    case "currency":
      formatted = currencyFormatter.format(Number(value));
      break;
    case "percent":
      formatted = percentFormatter.format(Number(value));
      break;
    case "compact":
      formatted = compactFormatter.format(Number(value));
      break;
    case "number":
      formatted = numberFormatter.format(Number(value));
      break;
    case "date":
      formatted = dateFormatter.format(new Date(value as string | number));
      break;
    case "badge":
    case "text":
    default:
      formatted = String(value);
      break;
  }

  const prefix = options?.prefix ?? "";
  const suffix = options?.suffix ?? "";
  return `${prefix}${formatted}${suffix}`;
}

/**
 * Format a cell value for table display
 */
export function formatCellValue(value: unknown, format?: FormatType): string {
  return formatValue(value, format);
}

// ============================================================================
// VISIBILITY EVALUATION
// ============================================================================

interface VisibilityContext {
  dataModel: Record<string, unknown>;
  authState?: { isSignedIn: boolean; user?: Record<string, unknown> };
}

function isPathCondition(c: VisibilityCondition): c is PathCondition {
  return typeof c === "object" && "path" in c;
}

function isAuthCondition(c: VisibilityCondition): c is AuthCondition {
  return typeof c === "object" && "auth" in c;
}

function isAndCondition(c: VisibilityCondition): c is AndCondition {
  return typeof c === "object" && "and" in c;
}

function isOrCondition(c: VisibilityCondition): c is OrCondition {
  return typeof c === "object" && "or" in c;
}

function isNotCondition(c: VisibilityCondition): c is NotCondition {
  return typeof c === "object" && "not" in c;
}

function isEqCondition(c: VisibilityCondition): c is EqCondition {
  return typeof c === "object" && "eq" in c;
}

function isGtCondition(c: VisibilityCondition): c is GtCondition {
  return typeof c === "object" && "gt" in c;
}

function isLtCondition(c: VisibilityCondition): c is LtCondition {
  return typeof c === "object" && "lt" in c;
}

/**
 * Resolve a value that might be a path reference
 */
function resolveValue(value: unknown, ctx: VisibilityContext): unknown {
  if (typeof value === "object" && value !== null && "path" in value) {
    return getValueByPath(ctx.dataModel, (value as PathCondition).path);
  }
  return value;
}

/**
 * Evaluate a visibility condition
 */
export function evaluateVisibility(
  condition: VisibilityCondition | undefined,
  ctx: VisibilityContext,
): boolean {
  if (condition === undefined) return true;
  if (typeof condition === "boolean") return condition;

  if (isPathCondition(condition)) {
    const value = getValueByPath(ctx.dataModel, condition.path);
    return Boolean(value);
  }

  if (isAuthCondition(condition)) {
    const isSignedIn = ctx.authState?.isSignedIn ?? false;
    return condition.auth === "signedIn" ? isSignedIn : !isSignedIn;
  }

  if (isAndCondition(condition)) {
    return condition.and.every((c) => evaluateVisibility(c, ctx));
  }

  if (isOrCondition(condition)) {
    return condition.or.some((c) => evaluateVisibility(c, ctx));
  }

  if (isNotCondition(condition)) {
    return !evaluateVisibility(condition.not, ctx);
  }

  if (isEqCondition(condition)) {
    const [a, b] = condition.eq;
    return resolveValue(a, ctx) === resolveValue(b, ctx);
  }

  if (isGtCondition(condition)) {
    const [a, b] = condition.gt;
    const aVal = resolveValue(a, ctx);
    const bVal = resolveValue(b, ctx);
    return Number(aVal) > Number(bVal);
  }

  if (isLtCondition(condition)) {
    const [a, b] = condition.lt;
    const aVal = resolveValue(a, ctx);
    const bVal = resolveValue(b, ctx);
    return Number(aVal) < Number(bVal);
  }

  return true;
}

// ============================================================================
// VALIDATION
// ============================================================================

import type { ValidationCheck, ValidationConfig } from "./types";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex = /^https?:\/\/.+/;

/**
 * Run a single validation check
 */
export function runValidationCheck(
  check: ValidationCheck,
  value: unknown,
): string | null {
  switch (check.fn) {
    case "required":
      if (value === null || value === undefined || value === "") {
        return check.message;
      }
      break;
    case "email":
      if (typeof value === "string" && !emailRegex.test(value)) {
        return check.message;
      }
      break;
    case "minLength":
      if (typeof value === "string" && value.length < (check.value as number)) {
        return check.message.replace("{value}", String(check.value));
      }
      break;
    case "maxLength":
      if (typeof value === "string" && value.length > (check.value as number)) {
        return check.message.replace("{value}", String(check.value));
      }
      break;
    case "min":
      if (Number(value) < (check.value as number)) {
        return check.message.replace("{value}", String(check.value));
      }
      break;
    case "max":
      if (Number(value) > (check.value as number)) {
        return check.message.replace("{value}", String(check.value));
      }
      break;
    case "pattern":
      if (typeof value === "string") {
        const regex = new RegExp(check.value as string);
        if (!regex.test(value)) {
          return check.message;
        }
      }
      break;
    case "url":
      if (typeof value === "string" && !urlRegex.test(value)) {
        return check.message;
      }
      break;
  }
  return null;
}

/**
 * Run all validation checks
 */
export function runValidation(
  config: ValidationConfig,
  value: unknown,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const check of config.checks) {
    const error = runValidationCheck(check, value);
    if (error) {
      errors.push(error);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// TREE UTILITIES
// ============================================================================

import type { UIElement, UITree } from "./types";

/**
 * Convert flat elements map to tree structure for rendering
 */
export function buildTreeFromElements(
  elements: Record<string, UIElement>,
  rootKey: string,
): UIElement | null {
  const root = elements[rootKey];
  if (!root) return null;

  return {
    ...root,
    children: root.children
      ?.map((childKey) => buildTreeFromElements(elements, childKey)?.key)
      .filter((k): k is string => k !== undefined),
  };
}

/**
 * Convert flat list to UITree (for streaming)
 */
export function flatToTree(
  elements: Array<UIElement & { parentKey?: string | null }>,
): UITree {
  const elementMap: Record<string, UIElement> = {};
  let root = "";

  // First pass: add all elements to map
  for (const element of elements) {
    elementMap[element.key] = {
      key: element.key,
      type: element.type,
      props: element.props,
      children: [],
      visible: element.visible,
    };
  }

  // Second pass: build parent-child relationships
  for (const element of elements) {
    if (element.parentKey) {
      const parent = elementMap[element.parentKey];
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(element.key);
      }
    } else {
      root = element.key;
    }
  }

  return { root, elements: elementMap };
}
