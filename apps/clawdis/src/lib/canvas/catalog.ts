/**
 * Canvas Component Catalog
 *
 * Defines all components the AI can generate. This is the constraint
 * that makes AI-generated UI safe and predictable.
 */

import { z } from "zod";
import { ActionSchema, VisibilityConditionSchema } from "./types";

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

const GapSchema = z.enum(["sm", "md", "lg"]).default("md");
const FormatSchema = z
  .enum(["currency", "percent", "number", "compact", "text", "date", "badge"])
  .default("number");
const SizeSchema = z.enum(["sm", "md", "lg"]).default("md");

// ============================================================================
// COMPONENT SCHEMAS
// ============================================================================

export const componentSchemas = {
  // === LAYOUT COMPONENTS ===
  Card: z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    variant: z.enum(["default", "outlined", "elevated"]).optional(),
  }),

  Grid: z.object({
    columns: z.number().min(1).max(12).default(2),
    gap: GapSchema,
  }),

  Stack: z.object({
    direction: z.enum(["vertical", "horizontal"]).default("vertical"),
    gap: GapSchema,
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
  }),

  Tabs: z.object({
    tabs: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    ),
    defaultTab: z.string().optional(),
  }),

  TabPanel: z.object({
    tabId: z.string(),
  }),

  // === DATA DISPLAY COMPONENTS ===
  Metric: z.object({
    label: z.string(),
    valuePath: z.string(),
    format: FormatSchema,
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    trend: z
      .object({
        valuePath: z.string(),
        goodDirection: z.enum(["up", "down"]),
      })
      .optional(),
  }),

  Chart: z.object({
    type: z.enum(["line", "bar", "area", "pie", "donut", "scatter"]),
    dataPath: z.string(),
    xKey: z.string(),
    yKey: z.string(),
    title: z.string().optional(),
    height: z.number().default(300),
    color: z.string().optional(),
    showGrid: z.boolean().default(true),
    showLegend: z.boolean().default(false),
  }),

  Table: z.object({
    dataPath: z.string(),
    columns: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        format: z
          .enum(["text", "number", "currency", "date", "badge"])
          .optional(),
        sortable: z.boolean().optional(),
      }),
    ),
    pageSize: z.number().default(10),
    showPagination: z.boolean().default(true),
  }),

  List: z.object({
    dataPath: z.string(),
    itemTemplate: z.object({
      primary: z.string(),
      secondary: z.string().optional(),
      icon: z.string().optional(),
    }),
    variant: z.enum(["default", "compact", "detailed"]).default("default"),
  }),

  Stat: z.object({
    label: z.string(),
    valuePath: z.string(),
    previousPath: z.string().optional(),
    format: FormatSchema,
  }),

  // === FORM COMPONENTS ===
  Form: z.object({
    id: z.string(),
    submitAction: ActionSchema,
    validateOnChange: z.boolean().default(false),
  }),

  TextField: z.object({
    label: z.string(),
    valuePath: z.string(),
    placeholder: z.string().optional(),
    type: z.enum(["text", "email", "password", "url", "tel"]).default("text"),
    required: z.boolean().optional(),
    validation: z
      .array(
        z.object({
          fn: z.enum([
            "required",
            "email",
            "minLength",
            "maxLength",
            "pattern",
          ]),
          value: z.unknown().optional(),
          message: z.string(),
        }),
      )
      .optional(),
  }),

  TextArea: z.object({
    label: z.string(),
    valuePath: z.string(),
    placeholder: z.string().optional(),
    rows: z.number().default(4),
    required: z.boolean().optional(),
  }),

  Select: z.object({
    label: z.string(),
    valuePath: z.string(),
    options: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    ),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
  }),

  Checkbox: z.object({
    label: z.string(),
    valuePath: z.string(),
  }),

  RadioGroup: z.object({
    label: z.string(),
    valuePath: z.string(),
    options: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    ),
    direction: z.enum(["horizontal", "vertical"]).default("vertical"),
  }),

  DatePicker: z.object({
    label: z.string(),
    valuePath: z.string(),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
    includeTime: z.boolean().default(false),
  }),

  Slider: z.object({
    label: z.string(),
    valuePath: z.string(),
    min: z.number(),
    max: z.number(),
    step: z.number().default(1),
    showValue: z.boolean().default(true),
  }),

  // === INTERACTIVE COMPONENTS ===
  Button: z.object({
    label: z.string(),
    action: ActionSchema,
    variant: z
      .enum(["primary", "secondary", "danger", "ghost"])
      .default("primary"),
    size: SizeSchema,
    icon: z.string().optional(),
    loading: z.object({ path: z.string() }).optional(),
    disabled: z.object({ path: z.string() }).optional(),
  }),

  Link: z.object({
    label: z.string(),
    href: z.string(),
    external: z.boolean().default(false),
  }),

  Toggle: z.object({
    label: z.string(),
    valuePath: z.string(),
    description: z.string().optional(),
  }),

  // === CONTENT COMPONENTS ===
  Text: z.object({
    content: z.string(),
    variant: z.enum(["body", "caption", "label", "heading"]).default("body"),
    color: z
      .enum(["default", "muted", "success", "warning", "error"])
      .optional(),
  }),

  Markdown: z.object({
    content: z.string(),
  }),

  Code: z.object({
    code: z.string(),
    language: z.string().default("typescript"),
    showLineNumbers: z.boolean().default(false),
    highlightLines: z.array(z.number()).optional(),
  }),

  Image: z.object({
    src: z.string(),
    alt: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  }),

  Divider: z.object({
    label: z.string().optional(),
  }),

  // === FEEDBACK COMPONENTS ===
  Alert: z.object({
    title: z.string().optional(),
    message: z.string(),
    variant: z.enum(["info", "success", "warning", "error"]).default("info"),
    dismissible: z.boolean().default(false),
  }),

  Progress: z.object({
    valuePath: z.string(),
    label: z.string().optional(),
    showValue: z.boolean().default(true),
    variant: z.enum(["bar", "circle"]).default("bar"),
  }),

  Badge: z.object({
    label: z.string(),
    variant: z
      .enum(["default", "success", "warning", "error", "info"])
      .default("default"),
  }),

  Empty: z.object({
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    action: ActionSchema.optional(),
  }),

  // === SPECIAL COMPONENTS ===
  Conditional: z.object({
    visible: VisibilityConditionSchema,
  }),

  Loop: z.object({
    dataPath: z.string(),
    itemKey: z.string(),
  }),
};

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

export const actionDefinitions = {
  navigate: {
    description: "Navigate to a different view or URL",
    params: z.object({
      to: z.string(),
      external: z.boolean().optional(),
    }),
  },

  refresh: {
    description: "Refresh data from source",
    params: z.object({
      dataPath: z.string().optional(),
    }),
  },

  submit: {
    description: "Submit form data",
    params: z.object({
      formId: z.string(),
      endpoint: z.string().optional(),
    }),
  },

  export_pdf: {
    description: "Export current view as PDF",
    params: z.object({
      filename: z.string().optional(),
    }),
  },

  export_csv: {
    description: "Export data as CSV",
    params: z.object({
      dataPath: z.string(),
      filename: z.string().optional(),
    }),
  },

  copy_to_clipboard: {
    description: "Copy value to clipboard",
    params: z.object({
      value: z.string(),
    }),
  },

  custom: {
    description: "Trigger a custom action handled by the application",
    params: z.object({
      type: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    }),
  },
};

// ============================================================================
// CATALOG TYPE
// ============================================================================

export type ComponentType = keyof typeof componentSchemas;
export type ActionType = keyof typeof actionDefinitions;

export interface CatalogComponent<T extends ComponentType> {
  type: T;
  props: z.infer<(typeof componentSchemas)[T]>;
  hasChildren: boolean;
  description: string;
}

// Component metadata
export const componentMeta: Record<
  ComponentType,
  { hasChildren: boolean; description: string }
> = {
  // Layout
  Card: {
    hasChildren: true,
    description: "Container with title, optional description, and children",
  },
  Grid: { hasChildren: true, description: "Responsive grid layout" },
  Stack: { hasChildren: true, description: "Vertical or horizontal stack" },
  Tabs: { hasChildren: true, description: "Tabbed interface" },
  TabPanel: { hasChildren: true, description: "Content panel for a tab" },

  // Data Display
  Metric: {
    hasChildren: false,
    description: "Single KPI with optional trend",
  },
  Chart: { hasChildren: false, description: "Data visualization chart" },
  Table: { hasChildren: false, description: "Data table with sorting" },
  List: { hasChildren: false, description: "Simple list display" },
  Stat: { hasChildren: false, description: "Statistic with comparison" },

  // Forms
  Form: { hasChildren: true, description: "Form container" },
  TextField: { hasChildren: false, description: "Text input field" },
  TextArea: { hasChildren: false, description: "Multi-line text input" },
  Select: { hasChildren: false, description: "Dropdown selection" },
  Checkbox: { hasChildren: false, description: "Boolean checkbox" },
  RadioGroup: { hasChildren: false, description: "Radio button group" },
  DatePicker: { hasChildren: false, description: "Date selection input" },
  Slider: { hasChildren: false, description: "Numeric range slider" },

  // Interactive
  Button: { hasChildren: false, description: "Clickable button" },
  Link: { hasChildren: false, description: "Clickable link" },
  Toggle: { hasChildren: false, description: "On/off toggle switch" },

  // Content
  Text: { hasChildren: false, description: "Text content" },
  Markdown: { hasChildren: false, description: "Rendered markdown" },
  Code: { hasChildren: false, description: "Syntax-highlighted code" },
  Image: { hasChildren: false, description: "Image display" },
  Divider: { hasChildren: false, description: "Visual separator" },

  // Feedback
  Alert: { hasChildren: false, description: "Contextual alert message" },
  Progress: { hasChildren: false, description: "Progress indicator" },
  Badge: { hasChildren: false, description: "Small status indicator" },
  Empty: { hasChildren: false, description: "Empty state placeholder" },

  // Special
  Conditional: {
    hasChildren: true,
    description: "Conditionally render children",
  },
  Loop: { hasChildren: true, description: "Repeat children for array items" },
};

// ============================================================================
// CATALOG PROMPT GENERATION
// ============================================================================

/**
 * Generate a system prompt describing the catalog for AI
 */
export function generateCatalogPrompt(): string {
  const lines: string[] = [
    "# Canvas Component Catalog",
    "",
    "When generating UI, use ONLY these components:",
    "",
    "## Components",
    "",
  ];

  // Group by category
  const categories = {
    Layout: ["Card", "Grid", "Stack", "Tabs", "TabPanel"],
    "Data Display": ["Metric", "Chart", "Table", "List", "Stat"],
    Forms: [
      "Form",
      "TextField",
      "TextArea",
      "Select",
      "Checkbox",
      "RadioGroup",
      "DatePicker",
      "Slider",
    ],
    Interactive: ["Button", "Link", "Toggle"],
    Content: ["Text", "Markdown", "Code", "Image", "Divider"],
    Feedback: ["Alert", "Progress", "Badge", "Empty"],
    Special: ["Conditional", "Loop"],
  } as const;

  for (const [category, components] of Object.entries(categories)) {
    lines.push(`### ${category}`);
    for (const name of components) {
      const meta = componentMeta[name as ComponentType];
      lines.push(
        `- **${name}**: ${meta.description}${meta.hasChildren ? " (has children)" : ""}`,
      );
    }
    lines.push("");
  }

  lines.push("## Actions");
  lines.push("");
  for (const [name, def] of Object.entries(actionDefinitions)) {
    lines.push(`- **${name}**: ${def.description}`);
  }
  lines.push("");

  lines.push("## Rules");
  lines.push("1. ONLY use components from this catalog");
  lines.push('2. Use JSON Pointer paths for data (e.g., "/metrics/revenue")');
  lines.push("3. Wrap content in Card or Grid layouts");
  lines.push("4. Use meaningful keys for each element");
  lines.push("5. Declare actions by name - the app handles execution");
  lines.push("");

  return lines.join("\n");
}
