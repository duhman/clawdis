/**
 * Canvas Renderer
 *
 * Renders a UITree using the component registry.
 */

import type { ComponentType } from "react";
import type { UIElement, UITree } from "./types";
import { useIsVisible, useActions } from "./context";
import type { ComponentRegistry, ComponentRenderProps } from "./registry";

// ============================================================================
// ELEMENT RENDERER
// ============================================================================

interface ElementRendererProps {
  element: UIElement;
  tree: UITree;
  registry: ComponentRegistry;
  loading?: boolean;
  fallback?: ComponentType<ComponentRenderProps>;
}

function ElementRenderer({
  element,
  tree,
  registry,
  loading,
  fallback,
}: ElementRendererProps) {
  const isVisible = useIsVisible(element.visible);
  const { execute } = useActions();

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Get the component renderer
  const Component = registry[element.type] ?? fallback;

  if (!Component) {
    console.warn(`No renderer for component type: ${element.type}`);
    return null;
  }

  // Render children recursively
  const children = element.children?.map((childKey) => {
    const childElement = tree.elements[childKey];
    if (!childElement) {
      return null;
    }
    return (
      <ElementRenderer
        key={childKey}
        element={childElement}
        tree={tree}
        registry={registry}
        loading={loading}
        fallback={fallback}
      />
    );
  });

  return (
    <Component element={element} onAction={execute} loading={loading}>
      {children}
    </Component>
  );
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

export interface RendererProps {
  tree: UITree | null;
  registry: ComponentRegistry;
  loading?: boolean;
  fallback?: ComponentType<ComponentRenderProps>;
}

export function Renderer({ tree, registry, loading, fallback }: RendererProps) {
  if (!tree || !tree.root) {
    return null;
  }

  const rootElement = tree.elements[tree.root];
  if (!rootElement) {
    return null;
  }

  return (
    <ElementRenderer
      element={rootElement}
      tree={tree}
      registry={registry}
      loading={loading}
      fallback={fallback}
    />
  );
}

// ============================================================================
// FALLBACK COMPONENT
// ============================================================================

export function FallbackComponent({ element, children }: ComponentRenderProps) {
  return (
    <div className="canvas-fallback">
      <span className="canvas-fallback__type">Unknown: {element.type}</span>
      {children}
    </div>
  );
}
