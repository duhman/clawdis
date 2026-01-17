/**
 * Canvas Panel Component
 *
 * The main canvas panel that renders AI-generated UI.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { UITree, Action } from "../../lib/canvas/types";

// Lazy-load Tauri event API to avoid ESM/CJS issues
type ListenFn = <T>(
  event: string,
  handler: (event: { payload: T }) => void,
) => Promise<() => void>;

async function getTauriListen(): Promise<ListenFn | null> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    return null;
  }
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return listen as ListenFn;
  } catch (err) {
    console.error("[canvas] Failed to load Tauri event API:", err);
    return null;
  }
}
import { CanvasProvider } from "../../lib/canvas/context";
import { Renderer, FallbackComponent } from "../../lib/canvas/renderer";
import { componentRegistry } from "../../lib/canvas/registry";
import { exportToReact, exportToJson } from "../../lib/canvas/export";
import { getValueByPath } from "../../lib/canvas/data";

import "./CanvasPanel.css";

// ============================================================================
// TYPES
// ============================================================================

interface CanvasPanelProps {
  conversationId: string;
  onExport?: (format: "react" | "json", code: string) => void;
  onClose?: () => void;
}

interface CanvasUpdateEvent {
  tree: UITree;
  data?: Record<string, unknown>;
}

// ============================================================================
// CANVAS PANEL
// ============================================================================

export function CanvasPanel({
  conversationId: _conversationId,
  onExport,
  onClose,
}: CanvasPanelProps) {
  const [canvasData, setCanvasData] = useState<Record<string, unknown>>({});
  const [tree, setTree] = useState<UITree | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Listen for canvas updates from chat
  useEffect(() => {
    let unlistenUpdate: (() => void) | null = null;
    let unlistenStreaming: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    const setup = async () => {
      const listen = await getTauriListen();
      if (!listen) return;

      unlistenUpdate = await listen<CanvasUpdateEvent>(
        "canvas:update",
        (event) => {
          setTree(event.payload.tree);
          setCanvasData(event.payload.data ?? {});
          setError(null);
        },
      );

      unlistenStreaming = await listen<{ streaming: boolean }>(
        "canvas:streaming",
        (event) => {
          setIsStreaming(event.payload.streaming);
        },
      );

      unlistenError = await listen<{ message: string }>(
        "canvas:error",
        (event) => {
          setError(new Error(event.payload.message));
        },
      );
    };

    setup();

    return () => {
      unlistenUpdate?.();
      unlistenStreaming?.();
      unlistenError?.();
    };
  }, []);

  // Handle data changes from two-way binding
  const handleDataChange = useCallback((path: string, value: unknown) => {
    setCanvasData((prev) => {
      const newData = { ...prev };
      const segments = path.startsWith("/")
        ? path.slice(1).split("/")
        : path.split("/");
      let current = newData;
      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        if (!(segment in current)) {
          current[segment] = {};
        }
        current = current[segment] as Record<string, unknown>;
      }
      current[segments[segments.length - 1]] = value;
      return newData;
    });
  }, []);

  // Handle actions
  const handleAction = useCallback(
    async (action: Action) => {
      switch (action.name) {
        case "navigate":
          if (action.params?.external) {
            window.open(action.params.to as string, "_blank");
          }
          break;

        case "copy_to_clipboard":
          await navigator.clipboard.writeText(action.params?.value as string);
          break;

        case "export_csv": {
          const { dataPath, filename = "export.csv" } = action.params as {
            dataPath: string;
            filename?: string;
          };
          const data = getValueByPath(canvasData, dataPath) as Record<
            string,
            unknown
          >[];
          if (!Array.isArray(data) || data.length === 0) {
            console.warn("No data to export at path:", dataPath);
            break;
          }

          const headers = Object.keys(data[0]);
          const csvRows = [
            headers.join(","),
            ...data.map((row) =>
              headers
                .map((h) => {
                  const val = String(row[h] ?? "");
                  return val.includes(",") ||
                    val.includes('"') ||
                    val.includes("\n")
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
                })
                .join(","),
            ),
          ];
          const csvContent = csvRows.join("\n");

          const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename.endsWith(".csv")
            ? filename
            : `${filename}.csv`;
          link.click();
          URL.revokeObjectURL(url);
          break;
        }

        case "export_pdf": {
          const { filename = "canvas-export.pdf" } = action.params as {
            filename?: string;
          };

          const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import("html2canvas"),
            import("jspdf"),
          ]);

          const contentElement = document.querySelector(
            ".canvas-panel__content",
          );
          if (!contentElement) {
            console.warn("No canvas content element found");
            break;
          }

          const canvas = await html2canvas(contentElement as HTMLElement, {
            backgroundColor: "#0f0f0f",
            scale: 2,
          });

          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF({
            orientation:
              canvas.width > canvas.height ? "landscape" : "portrait",
            unit: "px",
            format: [canvas.width, canvas.height],
          });

          pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
          pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
          break;
        }

        case "refresh": {
          const { dataPath } = action.params as { dataPath?: string };

          try {
            const { emit } = await import("@tauri-apps/api/event");
            await emit("canvas:refresh", { dataPath });
          } catch {
            window.dispatchEvent(
              new CustomEvent("canvas:refresh", { detail: { dataPath } }),
            );
          }
          break;
        }

        case "submit": {
          const { formId, endpoint } = action.params as {
            formId: string;
            endpoint?: string;
          };

          const formData = getValueByPath(
            canvasData,
            `/forms/${formId}`,
          ) as Record<string, unknown>;

          if (endpoint) {
            try {
              const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData ?? canvasData),
              });

              if (!response.ok) throw new Error(`HTTP ${response.status}`);

              window.dispatchEvent(
                new CustomEvent("canvas:submit:success", {
                  detail: { formId, response: await response.json() },
                }),
              );
            } catch (error) {
              window.dispatchEvent(
                new CustomEvent("canvas:submit:error", {
                  detail: { formId, error: (error as Error).message },
                }),
              );
            }
          } else {
            window.dispatchEvent(
              new CustomEvent("canvas:submit", {
                detail: { formId, data: formData ?? canvasData },
              }),
            );
          }
          break;
        }

        case "custom":
          window.dispatchEvent(
            new CustomEvent("canvas:action", { detail: action.params }),
          );
          break;

        default:
          console.log("Unhandled action:", action.name, action.params);
      }
    },
    [canvasData],
  );

  // Export handlers
  const handleExportReact = useCallback(() => {
    if (tree) {
      const code = exportToReact(tree, canvasData);
      onExport?.("react", code);
      navigator.clipboard.writeText(code);
    }
  }, [tree, canvasData, onExport]);

  const handleExportJson = useCallback(() => {
    if (tree) {
      const json = exportToJson(tree, canvasData);
      onExport?.("json", json);
      navigator.clipboard.writeText(json);
    }
  }, [tree, canvasData, onExport]);

  // Empty state
  if (!tree && !isStreaming && !error) {
    return (
      <div className="canvas-panel canvas-panel--empty">
        <div className="canvas-panel__empty">
          <span className="canvas-panel__empty-icon">🎨</span>
          <p className="canvas-panel__empty-title">No canvas content</p>
          <p className="canvas-panel__empty-description">
            Ask the AI to create a dashboard, form, or visualization
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-panel">
      {/* Toolbar */}
      <div className="canvas-panel__toolbar">
        <div className="canvas-panel__toolbar-left">
          <span className="canvas-panel__title">
            {(tree?.elements[tree.root]?.props as { title?: string })?.title ??
              "Canvas"}
          </span>
          {isStreaming && (
            <span className="canvas-panel__streaming">Generating...</span>
          )}
        </div>

        <div className="canvas-panel__toolbar-right">
          <button
            onClick={handleExportJson}
            className="canvas-panel__btn"
            title="Copy JSON"
          >
            📋 JSON
          </button>
          <button
            onClick={handleExportReact}
            className="canvas-panel__btn"
            title="Export React"
          >
            ⚛️ React
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="canvas-panel__btn canvas-panel__btn--close"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="canvas-panel__content">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="canvas-panel__error"
            >
              <span className="canvas-panel__error-icon">⚠️</span>
              <p>Failed to generate canvas</p>
              <p className="canvas-panel__error-message">{error.message}</p>
            </motion.div>
          ) : (
            <motion.div
              key={tree?.root ?? "loading"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="canvas-panel__renderer"
            >
              <CanvasProvider
                initialData={canvasData}
                onDataChange={handleDataChange}
                actionHandlers={{
                  navigate: async (params) =>
                    handleAction({ name: "navigate", params }),
                  copy_to_clipboard: async (params) =>
                    handleAction({ name: "copy_to_clipboard", params }),
                  custom: async (params) =>
                    handleAction({ name: "custom", params }),
                }}
              >
                <Renderer
                  tree={tree}
                  registry={componentRegistry}
                  loading={isStreaming}
                  fallback={FallbackComponent}
                />
              </CanvasProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default CanvasPanel;
