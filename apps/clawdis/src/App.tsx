import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import "./App.css";
import { ChatContainer, MessageInput } from "./components/Chat";
import { CanvasPanel } from "./components/Canvas";
import { SettingsWindow } from "./components/Settings";
import { SessionList } from "./components/Sessions";
import { OnboardingWizard } from "./components/Onboarding";
import {
  ThinkingSelector,
  type ThinkingLevel,
} from "./components/ThinkingSelector";
import { useGateway } from "./hooks/useGateway";
import { useCanvasChat } from "./hooks/useCanvasChat";
import { useTray } from "./hooks/useTray";
import { useWindowState } from "./hooks/useWindowState";
import { useNotifications } from "./hooks/useNotifications";
import { useHealth } from "./hooks/useHealth";
import { usePresence } from "./hooks/usePresence";
import { useGatewayStore } from "./stores/gateway";
import { useSessionsStore } from "./stores/sessions";
import { useOnboardingStore } from "./stores/onboarding";
import { useSettingsStore } from "./stores/settings";

function App() {
  const [thinking, setThinking] = useState<ThinkingLevel>("low");
  const [showCanvas, setShowCanvas] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessions, setShowSessions] = useState(true);

  const { sendMessage, abort } = useGateway({ autoConnect: true, thinking });
  const messages = useGatewayStore((state) => state.messages);
  const clearMessages = useGatewayStore((state) => state.clearMessages);
  const connectionStatus = useGatewayStore((state) => state.status);
  const usage = useGatewayStore((state) => state.usage);

  // Onboarding state
  const {
    isFirstLaunch,
    hasCompletedOnboarding,
    isInitialized: onboardingInitialized,
    load: loadOnboarding,
  } = useOnboardingStore();

  // Settings for gateway URL
  const gatewayUrl = useSettingsStore((state) => state.gatewayUrl);
  const setGatewayUrl = useSettingsStore((state) => state.setGatewayUrl);
  const loadSettings = useSettingsStore((state) => state.load);

  // Load onboarding and settings state on mount
  useEffect(() => {
    loadOnboarding();
    loadSettings();
  }, [loadOnboarding, loadSettings]);

  // Show onboarding wizard for first-time users
  const showOnboarding =
    onboardingInitialized && isFirstLaunch && !hasCompletedOnboarding;

  // Session switching
  const updateSession = useSessionsStore((state) => state.updateSession);
  const activeSessionId = useSessionsStore((state) => state.activeSessionId);

  const handleSessionChange = useCallback(
    (_sessionId: string) => {
      // When switching sessions, clear current messages and load session's messages
      // _sessionId will be used for message persistence in future iteration
      clearMessages();
      setShowCanvas(false);
    },
    [clearMessages],
  );

  const toggleSessions = useCallback(() => {
    setShowSessions((prev) => !prev);
  }, []);

  // Update session stats when messages change
  useEffect(() => {
    if (activeSessionId && messages.length > 0) {
      updateSession(activeSessionId, {
        messageCount: messages.length,
        lastMessageAt: Date.now(),
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      });
    }
  }, [activeSessionId, messages.length, usage, updateSession]);

  // Handle tray menu events
  const handleNewChat = useCallback(() => {
    clearMessages();
    setShowCanvas(false);
  }, [clearMessages]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  // Keyboard shortcut: Cmd+, to open settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Health monitoring
  const { status: healthStatus, latency } = useHealth({
    notifyOnDegraded: true,
  });

  // Sync tray with connection status, usage, and health
  useTray({
    onNewChat: handleNewChat,
    onSettings: handleOpenSettings,
    connectionStatus,
    usage,
    health: { status: healthStatus, latency },
  });

  // Persist window state across restarts
  useWindowState();

  // Presence reporting (sends presence to gateway, refreshes every 3 min)
  usePresence({ enabled: true });

  // Notifications
  const { notify } = useNotifications({ autoRequest: true });
  const isGenerating = useGatewayStore((state) => state.isGenerating);
  const wasGeneratingRef = useRef(false);

  // Send notification when response completes (only if window is not focused)
  useEffect(() => {
    if (wasGeneratingRef.current && !isGenerating) {
      // Response just completed
      if (!document.hasFocus()) {
        notify("Clawdis", "Response complete");
      }
    }
    wasGeneratingRef.current = isGenerating;
  }, [isGenerating, notify]);

  // Detect canvas blocks in messages
  const { hasCanvas } = useCanvasChat({
    messages,
    onCanvasDetected: useCallback(() => {
      setShowCanvas(true);
    }, []),
  });

  const handleExport = useCallback((format: "react" | "json", code: string) => {
    console.log(`Exported ${format}:`, code);
  }, []);

  const handleCloseCanvas = useCallback(() => {
    setShowCanvas(false);
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <div className="app-header__left">
          <button
            className="app-header__toggle-btn"
            onClick={toggleSessions}
            title={showSessions ? "Hide Sessions" : "Show Sessions"}
          >
            {showSessions ? "◀" : "▶"}
          </button>
          <h1>Clawdis</h1>
        </div>
        <div className="app-header__controls">
          {hasCanvas && !showCanvas && (
            <button
              className="app-header__canvas-btn"
              onClick={() => setShowCanvas(true)}
              title="Show Canvas"
            >
              🎨 Canvas
            </button>
          )}
          <ThinkingSelector value={thinking} onChange={setThinking} />
        </div>
      </header>

      <div className="app-content">
        {/* Session Sidebar */}
        {showSessions && <SessionList onSessionChange={handleSessionChange} />}

        <PanelGroup direction="horizontal" autoSaveId="clawdis-layout">
          {/* Chat Panel */}
          <Panel defaultSize={showCanvas ? 50 : 100} minSize={30}>
            <div className="app-panel">
              <ChatContainer />
            </div>
          </Panel>

          {/* Canvas Panel */}
          {showCanvas && (
            <>
              <PanelResizeHandle className="app-resize-handle" />
              <Panel defaultSize={50} minSize={25}>
                <CanvasPanel
                  conversationId="default"
                  onExport={handleExport}
                  onClose={handleCloseCanvas}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <footer className="app-footer">
        <MessageInput onSend={sendMessage} onAbort={abort} />
      </footer>

      {/* Settings Modal */}
      <SettingsWindow isOpen={showSettings} onClose={handleCloseSettings} />

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingWizard
          gatewayUrl={gatewayUrl}
          onGatewayUrlChange={setGatewayUrl}
          onComplete={() => {
            // Onboarding handles its own completion state
          }}
        />
      )}
    </main>
  );
}

export default App;
