/**
 * Canvas Module
 *
 * AI-generated UI system using json-render patterns.
 */

// Types
export type {
  UIElement,
  UITree,
  Action,
  ActionConfirm,
  VisibilityCondition,
  ValidationCheck,
  ValidationConfig,
  FormatType,
  ChartType,
  ButtonVariant,
  AlertVariant,
} from "./types";

export {
  ActionSchema,
  VisibilityConditionSchema,
  UIElementSchema,
  UITreeSchema,
} from "./types";

// Catalog
export {
  componentSchemas,
  actionDefinitions,
  componentMeta,
  generateCatalogPrompt,
} from "./catalog";
export type { ComponentType, ActionType } from "./catalog";

// Data utilities
export {
  getValueByPath,
  setValueByPath,
  formatValue,
  formatCellValue,
  evaluateVisibility,
  runValidation,
  runValidationCheck,
  flatToTree,
  buildTreeFromElements,
} from "./data";

// Context
export {
  DataProvider,
  VisibilityProvider,
  ActionProvider,
  CanvasProvider,
  ConfirmDialog,
  useData,
  useDataValue,
  useDataBinding,
  useVisibility,
  useIsVisible,
  useActions,
} from "./context";

// Registry
export { componentRegistry } from "./registry";
export type {
  ComponentRenderProps,
  ComponentRenderer,
  ComponentRegistry,
} from "./registry";

// Renderer
export { Renderer, FallbackComponent } from "./renderer";
export type { RendererProps } from "./renderer";

// Export
export {
  exportToReact,
  exportToJson,
  parseCanvasJson,
  buildTree,
} from "./export";
