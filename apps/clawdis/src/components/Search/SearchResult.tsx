/**
 * SearchResult Component
 * Displays a single search result with score and action buttons
 */

import { useState, useCallback } from "react";
import type { SearchResult as SearchResultType } from "../../lib/search";
import "./SearchResult.css";

export interface SearchResultProps {
  result: SearchResultType;
  onClick?: () => void;
  onCopy?: (content: string) => void;
  onInsert?: (content: string) => void;
}

export function SearchResult({
  result,
  onClick,
  onCopy,
  onInsert,
}: SearchResultProps) {
  const { document, score } = result;
  const [copied, setCopied] = useState(false);

  // Truncate content for display
  const truncatedContent =
    document.content.length > 200
      ? document.content.slice(0, 200) + "..."
      : document.content;

  // Format score as percentage (lower distance = higher similarity)
  const similarity = Math.max(0, Math.min(100, (1 - score) * 100)).toFixed(1);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(document.content);
        setCopied(true);
        onCopy?.(document.content);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API may not be available
      }
    },
    [document.content, onCopy],
  );

  const handleInsert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onInsert?.(document.content);
    },
    [document.content, onInsert],
  );

  const showActions = onCopy !== undefined || onInsert !== undefined;

  return (
    <div
      className={`search-result ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          onClick();
        }
      }}
    >
      <div className="search-result-header">
        <span className="search-result-id">{document.id}</span>
        <span className="search-result-score">{similarity}% match</span>
      </div>
      <div className="search-result-content">{truncatedContent}</div>
      {document.source && (
        <div className="search-result-meta">Source: {document.source}</div>
      )}
      {showActions && (
        <div className="search-result-actions">
          <button
            type="button"
            className="search-result-action"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          {onInsert && (
            <button
              type="button"
              className="search-result-action search-result-action-primary"
              onClick={handleInsert}
              title="Insert into chat"
            >
              Insert
            </button>
          )}
        </div>
      )}
    </div>
  );
}
