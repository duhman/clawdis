/**
 * SearchPanel Component
 * Search input with results list
 */

import { useState, useCallback } from "react";
import { useSearch, type UseSearchOptions } from "../../hooks/useSearch";
import { SearchResult } from "./SearchResult";
import "./SearchPanel.css";

export interface SearchPanelProps extends UseSearchOptions {
  onResultClick?: (result: { id: string; content: string }) => void;
  onCopy?: (content: string) => void;
  onInsert?: (content: string) => void;
  placeholder?: string;
}

export function SearchPanel({
  onResultClick,
  onCopy,
  onInsert,
  placeholder = "Search...",
  ...searchOptions
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const { results, isSearching, error, search, clearResults } =
    useSearch(searchOptions);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        await search(query);
      }
    },
    [query, search],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      if (!e.target.value.trim()) {
        clearResults();
      }
    },
    [clearResults],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setQuery("");
        clearResults();
      }
    },
    [clearResults],
  );

  return (
    <div className="search-panel">
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSearching}
        />
        <button
          type="submit"
          className="search-button"
          disabled={isSearching || !query.trim()}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div className="search-error">{error}</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <SearchResult
              key={result.document.id}
              result={result}
              onClick={
                onResultClick
                  ? () =>
                      onResultClick({
                        id: result.document.id,
                        content: result.document.content,
                      })
                  : undefined
              }
              onCopy={onCopy}
              onInsert={onInsert}
            />
          ))}
        </div>
      )}

      {!isSearching && !error && query && results.length === 0 && (
        <div className="search-no-results">No results found</div>
      )}
    </div>
  );
}
