/**
 * Settings Store with Persistence
 * Persists app settings across sessions using Tauri store plugin
 */

import { create } from "zustand";

const STORE_NAME = "settings.json";

// Lazy-load Tauri Store only when running in Tauri
type TauriStore = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

async function getTauriStore(): Promise<TauriStore | null> {
  // Check if running in Tauri
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    console.warn("[settings] Not running in Tauri, persistence disabled");
    return null;
  }

  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    return await Store.load(STORE_NAME);
  } catch (err) {
    console.error("[settings] Failed to load Tauri store:", err);
    return null;
  }
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface AppSettings {
  // Window state
  windowState: WindowState | null;

  // General settings (placeholders for Phase 2)
  launchAtLogin: boolean;
  showDockIcon: boolean;
  gatewayUrl: string;

  // Voice settings (placeholders for Phase 2)
  ttsEnabled: boolean;
  ttsVoice: string;
  pttKey: string;

  // Notification settings
  notificationsEnabled: boolean;

  // Update settings
  autoCheckUpdates: boolean;
}

export interface SettingsState extends AppSettings {
  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setWindowState: (state: WindowState) => void;
  setLaunchAtLogin: (enabled: boolean) => void;
  setShowDockIcon: (show: boolean) => void;
  setGatewayUrl: (url: string) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setTtsVoice: (voice: string) => void;
  setPttKey: (key: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setAutoCheckUpdates: (enabled: boolean) => void;

  // Persistence
  load: () => Promise<void>;
  save: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  windowState: null,
  launchAtLogin: false,
  showDockIcon: true,
  gatewayUrl: "ws://127.0.0.1:18789",
  ttsEnabled: true,
  ttsVoice: "default",
  pttKey: "Space",
  notificationsEnabled: true,
  autoCheckUpdates: true,
};

let store: TauriStore | null = null;
let storeLoadAttempted = false;

async function getStore(): Promise<TauriStore | null> {
  if (!storeLoadAttempted) {
    storeLoadAttempted = true;
    store = await getTauriStore();
  }
  return store;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Initial state
  ...DEFAULT_SETTINGS,
  isLoading: false,
  isInitialized: false,

  // Window state
  setWindowState: (windowState) => {
    set({ windowState });
    // Auto-save when window state changes
    get().save();
  },

  // General settings
  setLaunchAtLogin: (launchAtLogin) => {
    set({ launchAtLogin });
    get().save();
  },

  setShowDockIcon: (showDockIcon) => {
    set({ showDockIcon });
    get().save();
  },

  setGatewayUrl: (gatewayUrl) => {
    set({ gatewayUrl });
    get().save();
  },

  // Voice settings
  setTtsEnabled: (ttsEnabled) => {
    set({ ttsEnabled });
    get().save();
  },

  setTtsVoice: (ttsVoice) => {
    set({ ttsVoice });
    get().save();
  },

  setPttKey: (pttKey) => {
    set({ pttKey });
    get().save();
  },

  setNotificationsEnabled: (notificationsEnabled) => {
    set({ notificationsEnabled });
    get().save();
  },

  setAutoCheckUpdates: (autoCheckUpdates) => {
    set({ autoCheckUpdates });
    get().save();
  },

  // Load settings from store
  load: async () => {
    if (get().isLoading) return;

    set({ isLoading: true });

    try {
      const s = await getStore();

      // If no store available (not in Tauri), just use defaults
      if (!s) {
        set({ isLoading: false, isInitialized: true });
        return;
      }

      // Load each setting
      const windowState = await s.get<WindowState>("windowState");
      const launchAtLogin = await s.get<boolean>("launchAtLogin");
      const showDockIcon = await s.get<boolean>("showDockIcon");
      const gatewayUrl = await s.get<string>("gatewayUrl");
      const ttsEnabled = await s.get<boolean>("ttsEnabled");
      const ttsVoice = await s.get<string>("ttsVoice");
      const pttKey = await s.get<string>("pttKey");
      const notificationsEnabled = await s.get<boolean>("notificationsEnabled");
      const autoCheckUpdates = await s.get<boolean>("autoCheckUpdates");

      set({
        windowState: windowState ?? DEFAULT_SETTINGS.windowState,
        launchAtLogin: launchAtLogin ?? DEFAULT_SETTINGS.launchAtLogin,
        showDockIcon: showDockIcon ?? DEFAULT_SETTINGS.showDockIcon,
        gatewayUrl: gatewayUrl ?? DEFAULT_SETTINGS.gatewayUrl,
        ttsEnabled: ttsEnabled ?? DEFAULT_SETTINGS.ttsEnabled,
        ttsVoice: ttsVoice ?? DEFAULT_SETTINGS.ttsVoice,
        pttKey: pttKey ?? DEFAULT_SETTINGS.pttKey,
        notificationsEnabled:
          notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
        autoCheckUpdates: autoCheckUpdates ?? DEFAULT_SETTINGS.autoCheckUpdates,
        isLoading: false,
        isInitialized: true,
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
      set({ isLoading: false, isInitialized: true });
    }
  },

  // Save settings to store
  save: async () => {
    try {
      const s = await getStore();

      // If no store available (not in Tauri), skip saving
      if (!s) return;

      const state = get();

      await s.set("windowState", state.windowState);
      await s.set("launchAtLogin", state.launchAtLogin);
      await s.set("showDockIcon", state.showDockIcon);
      await s.set("gatewayUrl", state.gatewayUrl);
      await s.set("ttsEnabled", state.ttsEnabled);
      await s.set("ttsVoice", state.ttsVoice);
      await s.set("pttKey", state.pttKey);
      await s.set("notificationsEnabled", state.notificationsEnabled);
      await s.set("autoCheckUpdates", state.autoCheckUpdates);

      await s.save();
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  },
}));
