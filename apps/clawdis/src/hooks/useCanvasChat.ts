/**
 * useCanvasChat Hook
 *
 * Extends chat functionality to detect and emit canvas blocks.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { UITree } from "../lib/canvas/types";
import { parseCanvasJson } from "../lib/canvas/export";

// Lazy-load Tauri emit
async function emitEvent(event: string, payload?: unknown): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    return;
  }
  try {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(event, payload);
  } catch (err) {
    console.error("[canvas] Failed to emit event:", err);
  }
}

// ============================================================================
// CANVAS DETECTION
// ============================================================================

// Regex to detect canvas blocks in AI responses
// Matches ```canvas ... ``` blocks
const CANVAS_REGEX = /```canvas\n([\s\S]*?)\n```/g;

/**
 * Parse canvas blocks from a message content string
 */
export function parseCanvasBlocks(content: string): UITree[] {
  const trees: UITree[] = [];
  const matches = content.matchAll(CANVAS_REGEX);

  for (const match of matches) {
    try {
      const tree = parseCanvasJson(match[1]);
      if (tree) {
        trees.push(tree);
      }
    } catch (e) {
      console.error("Failed to parse canvas block:", e);
    }
  }

  return trees;
}

/**
 * Check if a message contains canvas blocks
 */
export function hasCanvasBlocks(content: string): boolean {
  return CANVAS_REGEX.test(content);
}

// ============================================================================
// HOOK
// ============================================================================

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface UseCanvasChatOptions {
  messages: Message[];
  onCanvasDetected?: (tree: UITree) => void;
}

interface UseCanvasChatReturn {
  /** Whether any message contains a canvas block */
  hasCanvas: boolean;
  /** The latest canvas tree (if any) */
  latestCanvas: UITree | null;
  /** Manually emit a canvas update */
  emitCanvas: (tree: UITree, data?: Record<string, unknown>) => void;
}

/**
 * Hook for detecting canvas blocks in chat messages and emitting events
 */
export function useCanvasChat({
  messages,
  onCanvasDetected,
}: UseCanvasChatOptions): UseCanvasChatReturn {
  const [hasCanvas, setHasCanvas] = useState(false);
  const [latestCanvas, setLatestCanvas] = useState<UITree | null>(null);
  const processedIds = useRef<Set<string>>(new Set());

  // Emit canvas update event
  const emitCanvas = useCallback(
    async (tree: UITree, data?: Record<string, unknown>) => {
      try {
        await emitEvent("canvas:update", {
          tree,
          data: data ?? tree.data ?? {},
        });
        setLatestCanvas(tree);
        setHasCanvas(true);
        onCanvasDetected?.(tree);
      } catch (e) {
        console.error("Failed to emit canvas update:", e);
      }
    },
    [onCanvasDetected],
  );

  // Watch for new messages with canvas blocks
  useEffect(() => {
    for (const message of messages) {
      // Only process assistant messages
      if (message.role !== "assistant") continue;

      // Skip already processed messages
      if (processedIds.current.has(message.id)) continue;

      // Check for canvas blocks
      const trees = parseCanvasBlocks(message.content);
      if (trees.length > 0) {
        // Emit the last canvas tree (most recent)
        const tree = trees[trees.length - 1];
        emitCanvas(tree, tree.data);
        processedIds.current.add(message.id);
      }
    }
  }, [messages, emitCanvas]);

  // Check if any message has canvas
  useEffect(() => {
    const hasAnyCanvas = messages.some(
      (m) => m.role === "assistant" && hasCanvasBlocks(m.content),
    );
    setHasCanvas(hasAnyCanvas);
  }, [messages]);

  return {
    hasCanvas,
    latestCanvas,
    emitCanvas,
  };
}

// ============================================================================
// STREAMING SUPPORT
// ============================================================================

/**
 * Hook for detecting canvas in streaming responses
 */
export function useCanvasStreaming() {
  const bufferRef = useRef("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Start streaming
  const startStreaming = useCallback(() => {
    bufferRef.current = "";
    setIsStreaming(true);
    emitEvent("canvas:streaming", { streaming: true });
  }, []);

  // Process a chunk of streaming content
  const processChunk = useCallback((chunk: string): UITree | null => {
    bufferRef.current += chunk;

    // Check if we have a complete canvas block
    const match = bufferRef.current.match(/```canvas\n([\s\S]*?)\n```/);
    if (match) {
      const tree = parseCanvasJson(match[1]);
      if (tree) {
        // Emit update and continue buffering for potential updates
        emitEvent("canvas:update", { tree, data: tree.data ?? {} });
        return tree;
      }
    }

    return null;
  }, []);

  // End streaming
  const endStreaming = useCallback(() => {
    setIsStreaming(false);
    emitEvent("canvas:streaming", { streaming: false });

    // Final check for canvas block
    const match = bufferRef.current.match(/```canvas\n([\s\S]*?)\n```/);
    if (match) {
      const tree = parseCanvasJson(match[1]);
      if (tree) {
        emitEvent("canvas:update", { tree, data: tree.data ?? {} });
        return tree;
      }
    }

    return null;
  }, []);

  return {
    isStreaming,
    startStreaming,
    processChunk,
    endStreaming,
    buffer: bufferRef.current,
  };
}

export default useCanvasChat;
