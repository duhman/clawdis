/**
 * Onboarding Wizard
 * First-run setup flow for new users
 */

import { useState, useCallback, useEffect } from "react";
import {
  useOnboardingStore,
  type OnboardingStep,
} from "../../stores/onboarding";
import { useSettingsStore } from "../../stores/settings";
import { useNotifications } from "../../hooks";
import "./OnboardingWizard.css";

export interface OnboardingWizardProps {
  /** Gateway URL for connection test */
  gatewayUrl: string;
  /** Callback when gateway URL changes */
  onGatewayUrlChange: (url: string) => void;
  /** Callback when onboarding completes */
  onComplete: () => void;
}

export function OnboardingWizard({
  gatewayUrl,
  onGatewayUrlChange,
  onComplete,
}: OnboardingWizardProps) {
  const { currentStep, setCurrentStep, completeOnboarding } =
    useOnboardingStore();

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-wizard">
        <StepIndicator currentStep={currentStep} />

        {currentStep === "welcome" && (
          <WelcomeStep onNext={() => setCurrentStep("gateway")} />
        )}

        {currentStep === "gateway" && (
          <GatewayStep
            gatewayUrl={gatewayUrl}
            onGatewayUrlChange={onGatewayUrlChange}
            onBack={() => setCurrentStep("welcome")}
            onNext={() => setCurrentStep("permissions")}
          />
        )}

        {currentStep === "permissions" && (
          <PermissionsStep
            onBack={() => setCurrentStep("gateway")}
            onNext={() => setCurrentStep("complete")}
          />
        )}

        {currentStep === "complete" && (
          <CompleteStep
            onFinish={async () => {
              await completeOnboarding();
              onComplete();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Step Indicator
function StepIndicator({ currentStep }: { currentStep: OnboardingStep }) {
  const steps: OnboardingStep[] = [
    "welcome",
    "gateway",
    "permissions",
    "complete",
  ];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="onboarding-steps">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`onboarding-step-dot ${
            index < currentIndex
              ? "completed"
              : index === currentIndex
                ? "active"
                : ""
          }`}
        />
      ))}
    </div>
  );
}

// Step 1: Welcome
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="onboarding-content">
      <div className="onboarding-icon">👋</div>
      <h1>Welcome to Clawdis</h1>
      <p className="onboarding-description">
        Your AI assistant powered by the Clawdbot Gateway. Let&apos;s get you
        set up in just a few steps.
      </p>

      <div className="onboarding-features">
        <div className="onboarding-feature">
          <span className="feature-icon">💬</span>
          <span>Chat with AI using natural language</span>
        </div>
        <div className="onboarding-feature">
          <span className="feature-icon">🔍</span>
          <span>Semantic search across your conversations</span>
        </div>
        <div className="onboarding-feature">
          <span className="feature-icon">🎤</span>
          <span>Voice input with push-to-talk</span>
        </div>
        <div className="onboarding-feature">
          <span className="feature-icon">⚡</span>
          <span>Quick launcher with keyboard shortcuts</span>
        </div>
      </div>

      <div className="onboarding-actions">
        <button className="onboarding-button primary" onClick={onNext}>
          Get Started
        </button>
      </div>
    </div>
  );
}

// Step 2: Gateway Setup
function GatewayStep({
  gatewayUrl,
  onGatewayUrlChange,
  onBack,
  onNext,
}: {
  gatewayUrl: string;
  onGatewayUrlChange: (url: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [localUrl, setLocalUrl] = useState(gatewayUrl);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTest = useCallback(async () => {
    setTestStatus("testing");
    setErrorMessage(null);

    try {
      // Try to establish a WebSocket connection
      const ws = new WebSocket(localUrl);

      const timeout = setTimeout(() => {
        ws.close();
        setTestStatus("error");
        setErrorMessage("Connection timed out");
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        setTestStatus("success");
        onGatewayUrlChange(localUrl);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setTestStatus("error");
        setErrorMessage("Failed to connect to gateway");
      };
    } catch (err) {
      setTestStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Connection failed");
    }
  }, [localUrl, onGatewayUrlChange]);

  return (
    <div className="onboarding-content">
      <div className="onboarding-icon">🌐</div>
      <h1>Connect to Gateway</h1>
      <p className="onboarding-description">
        Enter the URL of your Clawdbot Gateway server. This is where your AI
        requests will be processed.
      </p>

      <div className="onboarding-form">
        <label className="onboarding-label">
          Gateway URL
          <input
            type="text"
            className="onboarding-input"
            value={localUrl}
            onChange={(e) => {
              setLocalUrl(e.target.value);
              setTestStatus("idle");
            }}
            placeholder="ws://127.0.0.1:18789"
          />
        </label>

        {testStatus === "success" && (
          <div className="onboarding-status success">
            ✓ Connected successfully
          </div>
        )}

        {testStatus === "error" && (
          <div className="onboarding-status error">
            ✕ {errorMessage || "Connection failed"}
          </div>
        )}
      </div>

      <div className="onboarding-actions">
        <button className="onboarding-button secondary" onClick={onBack}>
          Back
        </button>
        <button
          className="onboarding-button secondary"
          onClick={handleTest}
          disabled={testStatus === "testing" || !localUrl}
        >
          {testStatus === "testing" ? "Testing..." : "Test Connection"}
        </button>
        <button
          className="onboarding-button primary"
          onClick={onNext}
          disabled={testStatus !== "success"}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Step 3: Permissions
function PermissionsStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  const { hasPermission, requestNotificationPermission } = useNotifications();
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore(
    (s) => s.setNotificationsEnabled,
  );

  const [micPermission, setMicPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");

  // Check mic permission on mount
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        setMicPermission("granted");
      })
      .catch(() => {
        setMicPermission("denied");
      });
  }, []);

  const handleRequestMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
    } catch {
      setMicPermission("denied");
    }
  }, []);

  const handleRequestNotifications = useCallback(async () => {
    await requestNotificationPermission();
    setNotificationsEnabled(true);
  }, [requestNotificationPermission, setNotificationsEnabled]);

  return (
    <div className="onboarding-content">
      <div className="onboarding-icon">🔐</div>
      <h1>Permissions</h1>
      <p className="onboarding-description">
        Grant permissions for optional features. You can change these later in
        Settings.
      </p>

      <div className="onboarding-permissions">
        <div className="permission-item">
          <div className="permission-info">
            <span className="permission-icon">🎤</span>
            <div>
              <div className="permission-title">Microphone</div>
              <div className="permission-description">
                Required for voice input and push-to-talk
              </div>
            </div>
          </div>
          <div className="permission-action">
            {micPermission === "granted" ? (
              <span className="permission-granted">✓ Granted</span>
            ) : (
              <button
                className="onboarding-button small"
                onClick={handleRequestMic}
              >
                Request
              </button>
            )}
          </div>
        </div>

        <div className="permission-item">
          <div className="permission-info">
            <span className="permission-icon">🔔</span>
            <div>
              <div className="permission-title">Notifications</div>
              <div className="permission-description">
                Get notified when responses are ready
              </div>
            </div>
          </div>
          <div className="permission-action">
            {hasPermission && notificationsEnabled ? (
              <span className="permission-granted">✓ Enabled</span>
            ) : (
              <button
                className="onboarding-button small"
                onClick={handleRequestNotifications}
              >
                Enable
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="onboarding-actions">
        <button className="onboarding-button secondary" onClick={onBack}>
          Back
        </button>
        <button className="onboarding-button primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
}

// Step 4: Complete
function CompleteStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="onboarding-content">
      <div className="onboarding-icon">🎉</div>
      <h1>You&apos;re All Set!</h1>
      <p className="onboarding-description">
        Clawdis is ready to use. Here are some tips to get started:
      </p>

      <div className="onboarding-tips">
        <div className="onboarding-tip">
          <span className="tip-shortcut">⌘ + Shift + Space</span>
          <span className="tip-text">Open quick launcher</span>
        </div>
        <div className="onboarding-tip">
          <span className="tip-shortcut">Hold Space</span>
          <span className="tip-text">Push-to-talk voice input</span>
        </div>
        <div className="onboarding-tip">
          <span className="tip-shortcut">⌘ + ,</span>
          <span className="tip-text">Open settings</span>
        </div>
        <div className="onboarding-tip">
          <span className="tip-shortcut">⌘ + N</span>
          <span className="tip-text">New chat session</span>
        </div>
      </div>

      <div className="onboarding-actions">
        <button className="onboarding-button primary" onClick={onFinish}>
          Start Using Clawdis
        </button>
      </div>
    </div>
  );
}

export default OnboardingWizard;
