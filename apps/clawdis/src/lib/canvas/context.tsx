/**
 * Canvas Context Providers
 *
 * Data, visibility, and action contexts for canvas rendering.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Action, VisibilityCondition } from "./types";
import { getValueByPath, setValueByPath, evaluateVisibility } from "./data";

// ============================================================================
// DATA CONTEXT
// ============================================================================

interface DataContextValue {
  data: Record<string, unknown>;
  authState: { isSignedIn: boolean; user?: Record<string, unknown> };
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
  initialData?: Record<string, unknown>;
  authState?: { isSignedIn: boolean; user?: Record<string, unknown> };
  onDataChange?: (path: string, value: unknown) => void;
  children: ReactNode;
}

export function DataProvider({
  initialData = {},
  authState = { isSignedIn: false },
  onDataChange,
  children,
}: DataProviderProps) {
  const [data, setData] = useState(initialData);

  const get = useCallback((path: string) => getValueByPath(data, path), [data]);

  const set = useCallback(
    (path: string, value: unknown) => {
      setData((prev) => {
        const next = setValueByPath(prev, path, value);
        onDataChange?.(path, value);
        return next;
      });
    },
    [onDataChange],
  );

  return (
    <DataContext.Provider value={{ data, authState, get, set }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within DataProvider");
  }
  return ctx;
}

export function useDataValue(path: string): unknown {
  const { get } = useData();
  return get(path);
}

export function useDataBinding(
  path: string,
): [unknown, (value: unknown) => void] {
  const { get, set } = useData();
  const value = get(path);
  const setValue = useCallback(
    (newValue: unknown) => set(path, newValue),
    [set, path],
  );
  return [value, setValue];
}

// ============================================================================
// VISIBILITY CONTEXT
// ============================================================================

interface VisibilityContextValue {
  isVisible: (condition: VisibilityCondition | undefined) => boolean;
}

const VisibilityContext = createContext<VisibilityContextValue | null>(null);

interface VisibilityProviderProps {
  children: ReactNode;
}

export function VisibilityProvider({ children }: VisibilityProviderProps) {
  const { data, authState } = useData();

  const isVisible = useCallback(
    (condition: VisibilityCondition | undefined) => {
      return evaluateVisibility(condition, { dataModel: data, authState });
    },
    [data, authState],
  );

  return (
    <VisibilityContext.Provider value={{ isVisible }}>
      {children}
    </VisibilityContext.Provider>
  );
}

export function useVisibility(): VisibilityContextValue {
  const ctx = useContext(VisibilityContext);
  if (!ctx) {
    throw new Error("useVisibility must be used within VisibilityProvider");
  }
  return ctx;
}

export function useIsVisible(
  condition: VisibilityCondition | undefined,
): boolean {
  const { isVisible } = useVisibility();
  return isVisible(condition);
}

// ============================================================================
// ACTION CONTEXT
// ============================================================================

interface ActionContextValue {
  execute: (action: Action) => Promise<void>;
  loadingActions: Set<string>;
  pendingConfirmation: {
    action: Action;
    resolve: () => void;
    reject: () => void;
  } | null;
  confirm: () => void;
  cancel: () => void;
}

const ActionContext = createContext<ActionContextValue | null>(null);

interface ActionProviderProps {
  handlers?: Record<
    string,
    (params: Record<string, unknown>) => Promise<unknown> | unknown
  >;
  navigate?: (path: string) => void;
  children: ReactNode;
}

export function ActionProvider({
  handlers = {},
  navigate,
  children,
}: ActionProviderProps) {
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    action: Action;
    resolve: () => void;
    reject: () => void;
  } | null>(null);
  const { set } = useData();

  const execute = useCallback(
    async (action: Action) => {
      // Handle confirmation
      if (action.confirm) {
        return new Promise<void>((resolve, reject) => {
          setPendingConfirmation({ action, resolve, reject });
        });
      }

      // Execute the action
      setLoadingActions((prev) => new Set([...prev, action.name]));

      try {
        const handler = handlers[action.name];
        if (handler) {
          await handler(action.params ?? {});
        } else if (action.name === "navigate" && navigate) {
          const to = (action.params?.to as string) ?? "/";
          const external = action.params?.external as boolean;
          if (external) {
            window.open(to, "_blank");
          } else {
            navigate(to);
          }
        } else if (action.name === "copy_to_clipboard") {
          const value = action.params?.value as string;
          await navigator.clipboard.writeText(value);
        } else {
          console.warn(`No handler for action: ${action.name}`);
        }

        // Handle onSuccess
        if (action.onSuccess?.set) {
          for (const [path, value] of Object.entries(action.onSuccess.set)) {
            set(path, value);
          }
        }
        if (action.onSuccess?.navigate && navigate) {
          navigate(action.onSuccess.navigate);
        }
      } catch (error) {
        // Handle onError
        if (action.onError?.set) {
          for (const [path, value] of Object.entries(action.onError.set)) {
            const resolvedValue =
              value === "$error.message" ? (error as Error).message : value;
            set(path, resolvedValue);
          }
        }
        throw error;
      } finally {
        setLoadingActions((prev) => {
          const next = new Set(prev);
          next.delete(action.name);
          return next;
        });
      }
    },
    [handlers, navigate, set],
  );

  const confirm = useCallback(() => {
    if (pendingConfirmation) {
      setPendingConfirmation(null);
      const actionWithoutConfirm = {
        ...pendingConfirmation.action,
        confirm: undefined,
      };
      execute(actionWithoutConfirm).then(pendingConfirmation.resolve);
    }
  }, [pendingConfirmation, execute]);

  const cancel = useCallback(() => {
    if (pendingConfirmation) {
      pendingConfirmation.reject();
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  return (
    <ActionContext.Provider
      value={{ execute, loadingActions, pendingConfirmation, confirm, cancel }}
    >
      {children}
    </ActionContext.Provider>
  );
}

export function useActions(): ActionContextValue {
  const ctx = useContext(ActionContext);
  if (!ctx) {
    throw new Error("useActions must be used within ActionProvider");
  }
  return ctx;
}

// ============================================================================
// CONFIRM DIALOG
// ============================================================================

interface ConfirmDialogProps {
  confirm: { title: string; message: string; variant?: "default" | "danger" };
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  confirm,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="canvas-confirm-overlay">
      <div className="canvas-confirm-dialog">
        <h3 className="canvas-confirm-title">{confirm.title}</h3>
        <p className="canvas-confirm-message">{confirm.message}</p>
        <div className="canvas-confirm-actions">
          <button
            onClick={onCancel}
            className="canvas-confirm-btn canvas-confirm-btn-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`canvas-confirm-btn canvas-confirm-btn-confirm ${
              confirm.variant === "danger" ? "canvas-confirm-btn-danger" : ""
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMBINED PROVIDER
// ============================================================================

interface CanvasProviderProps {
  initialData?: Record<string, unknown>;
  authState?: { isSignedIn: boolean; user?: Record<string, unknown> };
  actionHandlers?: Record<
    string,
    (params: Record<string, unknown>) => Promise<unknown> | unknown
  >;
  navigate?: (path: string) => void;
  onDataChange?: (path: string, value: unknown) => void;
  children: ReactNode;
}

export function CanvasProvider({
  initialData,
  authState,
  actionHandlers,
  navigate,
  onDataChange,
  children,
}: CanvasProviderProps) {
  return (
    <DataProvider
      initialData={initialData}
      authState={authState}
      onDataChange={onDataChange}
    >
      <VisibilityProvider>
        <ActionProvider handlers={actionHandlers} navigate={navigate}>
          {children}
          <ConfirmationDialogManager />
        </ActionProvider>
      </VisibilityProvider>
    </DataProvider>
  );
}

function ConfirmationDialogManager() {
  const { pendingConfirmation, confirm, cancel } = useActions();

  if (!pendingConfirmation?.action.confirm) {
    return null;
  }

  return (
    <ConfirmDialog
      confirm={pendingConfirmation.action.confirm}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
}
