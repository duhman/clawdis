/**
 * useSearch Hook
 * Provides semantic search functionality using LanceDB
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { DocumentIndexer, type SearchResult } from "../lib/search";
import type { GatewayClient } from "../lib/gateway/client";

export type SearchMode = "vector" | "fts" | "hybrid";

export interface UseSearchOptions {
  dbPath?: string;
  useMockEmbeddings?: boolean;
  limit?: number;
  client?: GatewayClient | null;
  mode?: SearchMode;
}

export interface UseSearchReturn {
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

/**
 * Hook for semantic search over indexed documents
 * Pass gateway client for real embeddings, or use mock embeddings for testing
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    dbPath,
    useMockEmbeddings = false,
    limit = 10,
    client,
    mode = "vector",
  } = options;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexerRef = useRef<DocumentIndexer | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // Initialize indexer lazily
  const getIndexer = useCallback(async (): Promise<DocumentIndexer> => {
    if (indexerRef.current) {
      return indexerRef.current;
    }

    if (initPromiseRef.current) {
      await initPromiseRef.current;
      return indexerRef.current!;
    }

    const indexer = new DocumentIndexer({ dbPath, useMockEmbeddings });

    initPromiseRef.current = indexer.init(client ?? undefined);
    await initPromiseRef.current;

    indexerRef.current = indexer;
    return indexer;
  }, [dbPath, useMockEmbeddings, client]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (indexerRef.current) {
        indexerRef.current.close().catch(console.error);
        indexerRef.current = null;
        initPromiseRef.current = null;
      }
    };
  }, []);

  const search = useCallback(
    async (query: string): Promise<void> => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const indexer = await getIndexer();
        let searchResults;
        switch (mode) {
          case "fts":
            searchResults = await indexer.searchFts(query, limit);
            break;
          case "hybrid":
            searchResults = await indexer.searchHybrid(query, limit);
            break;
          default:
            searchResults = await indexer.search(query, limit);
        }
        setResults(searchResults);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        setError(message);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [getIndexer, limit, mode],
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    clearResults,
  };
}
