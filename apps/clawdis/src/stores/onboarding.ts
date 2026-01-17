/**
 * Onboarding Store
 * Tracks first-run and onboarding wizard state
 */

import { create } from "zustand";

const STORE_NAME = "onboarding.json";

// Lazy-load Tauri Store only when running in Tauri
type TauriStore = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

async function getTauriStore(): Promise<TauriStore | null> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    return null;
  }

  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    return await Store.load(STORE_NAME);
  } catch (err) {
    console.error("[onboarding] Failed to load Tauri store:", err);
    return null;
  }
}

export type OnboardingStep = "welcome" | "gateway" | "permissions" | "complete";

export interface OnboardingState {
  /** Whether this is the first launch */
  isFirstLaunch: boolean;
  /** Whether onboarding has been completed */
  hasCompletedOnboarding: boolean;
  /** Current onboarding step */
  currentStep: OnboardingStep;
  /** Loading state */
  isLoading: boolean;
  /** Whether state has been initialized from storage */
  isInitialized: boolean;

  // Actions
  setCurrentStep: (step: OnboardingStep) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  load: () => Promise<void>;
}

let store: TauriStore | null = null;
let storeLoadAttempted = false;

async function getStore(): Promise<TauriStore | null> {
  if (!storeLoadAttempted) {
    storeLoadAttempted = true;
    store = await getTauriStore();
  }
  return store;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  // Initial state
  isFirstLaunch: true,
  hasCompletedOnboarding: false,
  currentStep: "welcome",
  isLoading: false,
  isInitialized: false,

  setCurrentStep: (currentStep) => {
    set({ currentStep });
  },

  completeOnboarding: async () => {
    try {
      const s = await getStore();
      if (s) {
        await s.set("hasCompletedOnboarding", true);
        await s.set("isFirstLaunch", false);
        await s.save();
      }

      set({
        hasCompletedOnboarding: true,
        isFirstLaunch: false,
        currentStep: "complete",
      });
    } catch (err) {
      console.error("[Onboarding] Failed to save completion:", err);
    }
  },

  resetOnboarding: async () => {
    try {
      const s = await getStore();
      if (s) {
        await s.set("hasCompletedOnboarding", false);
        await s.set("isFirstLaunch", true);
        await s.save();
      }

      set({
        hasCompletedOnboarding: false,
        isFirstLaunch: true,
        currentStep: "welcome",
      });
    } catch (err) {
      console.error("[Onboarding] Failed to reset:", err);
    }
  },

  load: async () => {
    if (get().isLoading) return;

    set({ isLoading: true });

    try {
      const s = await getStore();

      // If no store available (not in Tauri), use defaults
      if (!s) {
        set({ isLoading: false, isInitialized: true });
        return;
      }

      const hasCompletedOnboarding = await s.get<boolean>(
        "hasCompletedOnboarding",
      );
      const isFirstLaunch = await s.get<boolean>("isFirstLaunch");

      // If we've never stored isFirstLaunch, this is truly first launch
      const actualFirstLaunch = isFirstLaunch ?? isFirstLaunch === undefined;

      set({
        hasCompletedOnboarding: hasCompletedOnboarding ?? false,
        isFirstLaunch: actualFirstLaunch,
        isLoading: false,
        isInitialized: true,
      });
    } catch (err) {
      console.error("[Onboarding] Failed to load:", err);
      set({ isLoading: false, isInitialized: true });
    }
  },
}));
