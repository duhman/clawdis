/**
 * Recent Items Store
 * Tracks recently used commands and searches
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentItem {
  id: string;
  type: "command" | "search" | "message";
  label: string;
  value: string;
  timestamp: number;
}

interface RecentState {
  items: RecentItem[];
  maxItems: number;

  // Actions
  addItem: (item: Omit<RecentItem, "timestamp">) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  getRecentByType: (type: RecentItem["type"]) => RecentItem[];
}

const DEFAULT_MAX_ITEMS = 20;

export const useRecentStore = create<RecentState>()(
  persist(
    (set, get) => ({
      items: [],
      maxItems: DEFAULT_MAX_ITEMS,

      addItem: (item) => {
        set((state) => {
          // Remove existing item with same id
          const filtered = state.items.filter((i) => i.id !== item.id);

          // Add new item at the beginning
          const newItem: RecentItem = {
            ...item,
            timestamp: Date.now(),
          };

          // Trim to max items
          const items = [newItem, ...filtered].slice(0, state.maxItems);

          return { items };
        });
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      clearItems: () => {
        set({ items: [] });
      },

      getRecentByType: (type) => {
        return get().items.filter((item) => item.type === type);
      },
    }),
    {
      name: "clawdis-recent",
    },
  ),
);

/**
 * Convert recent items to launcher commands
 */
export function recentItemsToCommands(
  items: RecentItem[],
  onSelect: (item: RecentItem) => void,
) {
  return items.map((item) => ({
    id: `recent-${item.id}`,
    name: item.label,
    description: `Recent ${item.type}`,
    keywords: ["recent", item.type, item.value],
    icon: item.type === "command" ? "🕐" : item.type === "search" ? "🔍" : "💬",
    action: () => onSelect(item),
  }));
}
