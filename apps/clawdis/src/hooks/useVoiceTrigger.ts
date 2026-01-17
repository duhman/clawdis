/**
 * useVoiceTrigger Hook
 * Provides push-to-talk functionality with keyboard/mouse triggers
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioCapture, UseAudioCaptureOptions } from "./useAudioCapture";

export type VoiceTriggerMode = "push-to-talk" | "toggle" | "voice-activity";
export type VoiceTriggerState = "idle" | "listening" | "processing";

export interface UseVoiceTriggerOptions extends UseAudioCaptureOptions {
  /** Trigger mode (default: push-to-talk) */
  mode?: VoiceTriggerMode;
  /** Key for push-to-talk (default: Space) */
  triggerKey?: string;
  /** Minimum recording duration in seconds (default: 0.5) */
  minDuration?: number;
  /** Maximum recording duration in seconds (default: 60) */
  maxDuration?: number;
  /** Callback when recording starts */
  onStart?: () => void;
  /** Callback when recording ends */
  onEnd?: (audio: { blob: Blob; base64: string }) => void;
}

export interface UseVoiceTriggerReturn {
  /** Current state */
  state: VoiceTriggerState;
  /** Whether currently listening/recording */
  isListening: boolean;
  /** Current recording duration in seconds */
  duration: number;
  /** Microphone permission state */
  permissionState: PermissionState | null;
  /** Start listening (for toggle mode or programmatic control) */
  startListening: () => Promise<void>;
  /** Stop listening (for toggle mode or programmatic control) */
  stopListening: () => Promise<void>;
  /** Cancel current recording */
  cancel: () => void;
  /** Whether push-to-talk is active (key is held) */
  isPushActive: boolean;
}

export function useVoiceTrigger(
  options: UseVoiceTriggerOptions = {},
): UseVoiceTriggerReturn {
  const {
    mode = "push-to-talk",
    triggerKey = " ", // Space
    minDuration = 0.5,
    maxDuration = 60,
    onStart,
    onEnd,
    onComplete,
    onError,
    onChunk,
  } = options;

  const [state, setState] = useState<VoiceTriggerState>("idle");
  const [isPushActive, setIsPushActive] = useState(false);

  const isProcessingRef = useRef(false);
  const maxDurationTimerRef = useRef<number | null>(null);

  const handleComplete = useCallback(
    (audio: { blob: Blob; base64: string; duration: number }) => {
      if (audio.duration >= minDuration) {
        onEnd?.({ blob: audio.blob, base64: audio.base64 });
        onComplete?.(audio);
      }
      setState("idle");
      isProcessingRef.current = false;
    },
    [minDuration, onEnd, onComplete],
  );

  const audioCapture = useAudioCapture({
    onChunk,
    onComplete: handleComplete,
    onError: (error) => {
      setState("idle");
      isProcessingRef.current = false;
      onError?.(error);
    },
  });

  const startListening = useCallback(async () => {
    if (state !== "idle" || isProcessingRef.current) return;

    setState("listening");
    onStart?.();
    await audioCapture.start();

    // Set max duration timer
    maxDurationTimerRef.current = window.setTimeout(() => {
      if (audioCapture.isRecording) {
        audioCapture.stop();
      }
    }, maxDuration * 1000);
  }, [state, audioCapture, maxDuration, onStart]);

  const stopListening = useCallback(async () => {
    if (state !== "listening") return;

    // Clear max duration timer
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }

    if (audioCapture.duration < minDuration) {
      // Recording too short, cancel
      audioCapture.cancel();
      setState("idle");
      return;
    }

    setState("processing");
    isProcessingRef.current = true;
    await audioCapture.stop();
  }, [state, audioCapture, minDuration]);

  const cancel = useCallback(() => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    audioCapture.cancel();
    setState("idle");
    isProcessingRef.current = false;
    setIsPushActive(false);
  }, [audioCapture]);

  // Push-to-talk keyboard handling
  useEffect(() => {
    if (mode !== "push-to-talk") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === triggerKey && !event.repeat) {
        event.preventDefault();
        setIsPushActive(true);
        startListening();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === triggerKey) {
        event.preventDefault();
        setIsPushActive(false);
        stopListening();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode, triggerKey, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    isListening: state === "listening",
    duration: audioCapture.duration,
    permissionState: audioCapture.permissionState,
    startListening,
    stopListening,
    cancel,
    isPushActive,
  };
}
