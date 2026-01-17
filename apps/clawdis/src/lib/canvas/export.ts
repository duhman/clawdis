/**
 * Canvas Export Utilities
 *
 * Export canvas to React code or JSON.
 */

import type { UITree, UIElement } from "./types";

// ============================================================================
// REACT EXPORT
// ============================================================================

interface ExportOptions {
  includeStyles?: boolean;
  framework?: "react" | "nextjs";
}

/**
 * Export a UITree to React component code
 */
export function exportToReact(
  tree: UITree,
  data: Record<string, unknown>,
  options: ExportOptions = {},
): string {
  const { framework = "nextjs" } = options;

  const imports = new Set<string>();
  const componentCode = generateComponentCode(tree, tree.root, imports);

  const importStatements = Array.from(imports)
    .map((imp) => `import { ${imp} } from "@/components/ui";`)
    .join("\n");

  const dataJson = JSON.stringify(data, null, 2);

  return `${framework === "nextjs" ? '"use client";\n\n' : ""}${importStatements}

const data = ${dataJson};

export default function GeneratedUI() {
  return (
${indent(componentCode, 4)}
  );
}
`;
}

/**
 * Generate React code for a single element
 */
function generateComponentCode(
  tree: UITree,
  elementKey: string,
  imports: Set<string>,
): string {
  const element = tree.elements[elementKey];
  if (!element) return "";

  imports.add(element.type);

  // Format props as JSX attributes
  const propsStr = Object.entries(element.props ?? {})
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (typeof v === "string") return `${k}="${escapeString(v)}"`;
      if (typeof v === "boolean") return v ? k : "";
      return `${k}={${JSON.stringify(v)}}`;
    })
    .filter(Boolean)
    .join(" ");

  // Generate children
  const children = element.children
    ?.map((childKey) => generateComponentCode(tree, childKey, imports))
    .filter(Boolean)
    .join("\n");

  if (children) {
    return `<${element.type}${propsStr ? " " + propsStr : ""}>
${indent(children, 2)}
</${element.type}>`;
  }

  return `<${element.type}${propsStr ? " " + propsStr : ""} />`;
}

/**
 * Indent a string by a number of spaces
 */
function indent(str: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return str
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

/**
 * Escape special characters in strings
 */
function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ============================================================================
// JSON EXPORT
// ============================================================================

/**
 * Export a UITree and data as JSON
 */
export function exportToJson(
  tree: UITree,
  data: Record<string, unknown>,
): string {
  return JSON.stringify(
    {
      root: tree.root,
      elements: tree.elements,
      data,
    },
    null,
    2,
  );
}

// ============================================================================
// IMPORT / PARSE
// ============================================================================

/**
 * Parse a canvas JSON block from AI response
 */
export function parseCanvasJson(jsonString: string): UITree | null {
  try {
    const parsed = JSON.parse(jsonString);

    // Validate basic structure
    if (!parsed.root || !parsed.elements) {
      console.error("Invalid canvas JSON: missing root or elements");
      return null;
    }

    return {
      root: parsed.root,
      elements: parsed.elements,
      data: parsed.data,
    };
  } catch (error) {
    console.error("Failed to parse canvas JSON:", error);
    return null;
  }
}

/**
 * Build tree structure from flat elements
 */
export function buildTree(
  elements: Record<string, UIElement>,
  rootKey: string,
): UITree {
  return {
    root: rootKey,
    elements,
  };
}
