/**
 * Canvas Types
 *
 * Core types for AI-generated UI using json-render patterns.
 */

import { z } from "zod";

// ============================================================================
// VISIBILITY
// ============================================================================

/** Path-based visibility condition */
export interface PathCondition {
  path: string;
}

/** Auth-based visibility condition */
export interface AuthCondition {
  auth: "signedIn" | "signedOut";
}

/** Boolean logic conditions */
export interface AndCondition {
  and: VisibilityCondition[];
}

export interface OrCondition {
  or: VisibilityCondition[];
}

export interface NotCondition {
  not: VisibilityCondition;
}

/** Comparison conditions */
export interface EqCondition {
  eq: [unknown, unknown];
}

export interface GtCondition {
  gt: [unknown, unknown];
}

export interface LtCondition {
  lt: [unknown, unknown];
}

export type VisibilityCondition =
  | boolean
  | PathCondition
  | AuthCondition
  | AndCondition
  | OrCondition
  | NotCondition
  | EqCondition
  | GtCondition
  | LtCondition;

// ============================================================================
// ACTIONS
// ============================================================================

export interface ActionConfirm {
  title: string;
  message: string;
  variant?: "default" | "danger";
}

export interface Action {
  name: string;
  params?: Record<string, unknown>;
  confirm?: ActionConfirm;
  onSuccess?: { navigate?: string; set?: Record<string, unknown> };
  onError?: { set?: Record<string, unknown> };
}

// ============================================================================
// UI ELEMENTS
// ============================================================================

export interface UIElement<
  T extends string = string,
  P = Record<string, unknown>,
> {
  key: string;
  type: T;
  props: P;
  children?: string[];
  parentKey?: string | null;
  visible?: VisibilityCondition;
}

export interface UITree {
  root: string;
  elements: Record<string, UIElement>;
  data?: Record<string, unknown>;
}

// ============================================================================
// VALIDATION
// ============================================================================

export type ValidationFn =
  | "required"
  | "email"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "min"
  | "max"
  | "url";

export interface ValidationCheck {
  fn: ValidationFn;
  value?: unknown;
  message: string;
}

export interface ValidationConfig {
  checks: ValidationCheck[];
  validateOn?: "change" | "blur" | "submit";
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const ActionSchema = z.object({
  name: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  confirm: z
    .object({
      title: z.string(),
      message: z.string(),
      variant: z.enum(["default", "danger"]).optional(),
    })
    .optional(),
});

export const VisibilityConditionSchema: z.ZodType<VisibilityCondition> = z.lazy(
  () =>
    z.union([
      z.boolean(),
      z.object({ path: z.string() }),
      z.object({ auth: z.enum(["signedIn", "signedOut"]) }),
      z.object({ and: z.array(VisibilityConditionSchema) }),
      z.object({ or: z.array(VisibilityConditionSchema) }),
      z.object({ not: VisibilityConditionSchema }),
      z.object({ eq: z.tuple([z.unknown(), z.unknown()]) }),
      z.object({ gt: z.tuple([z.unknown(), z.unknown()]) }),
      z.object({ lt: z.tuple([z.unknown(), z.unknown()]) }),
    ]),
);

export const UIElementSchema = z.object({
  key: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).optional(),
  parentKey: z.string().nullable().optional(),
  visible: VisibilityConditionSchema.optional(),
});

export const UITreeSchema = z.object({
  root: z.string(),
  elements: z.record(z.string(), UIElementSchema),
  data: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// COMPONENT TYPES
// ============================================================================

export type FormatType =
  | "currency"
  | "percent"
  | "number"
  | "compact"
  | "text"
  | "date"
  | "badge";
export type GapSize = "sm" | "md" | "lg";
export type ChartType = "line" | "bar" | "area" | "pie" | "donut" | "scatter";
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type AlertVariant = "info" | "success" | "warning" | "error";

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface CanvasDataContext {
  data: Record<string, unknown>;
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
}

export interface CanvasAuthContext {
  isSignedIn: boolean;
  user?: Record<string, unknown>;
}

export interface CanvasActionContext {
  execute: (action: Action) => Promise<void>;
  loadingActions: Set<string>;
  pendingConfirmation: { action: Action; resolve: () => void } | null;
  confirm: () => void;
  cancel: () => void;
}
