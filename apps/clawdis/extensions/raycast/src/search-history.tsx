import { Action, ActionPanel, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import { request, getSessionKey } from "./gateway";

interface SearchResult {
  id: string;
  content: string;
  role: string;
  score: number;
}

interface SearchResponse {
  results: SearchResult[];
}

export default function SearchHistory() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await request<SearchResponse>("search.query", {
        query: searchQuery,
        sessionKey: getSessionKey(),
        limit: 20,
      });

      setResults(response.results || []);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <List
      isLoading={isLoading}
      searchText={query}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search your conversation history..."
    >
      {results.length === 0 && query && !isLoading ? (
        <List.EmptyView
          title="No results found"
          description="Try a different search query"
        />
      ) : (
        results.map((result) => (
          <List.Item
            key={result.id}
            title={result.content.slice(0, 80)}
            subtitle={result.role === "user" ? "You" : "Clawdbot"}
            accessories={[
              {
                text: `${Math.round((1 - result.score) * 100)}% match`,
              },
            ]}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Content"
                  content={result.content}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
