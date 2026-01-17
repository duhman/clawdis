/**
 * useAudioCapture Hook
 * Provides audio recording functionality with React state management
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AudioRecorder,
  AudioCaptureState,
  AudioChunk,
  checkMicrophonePermission,
  blobToBase64,
} from "../lib/voice";

export interface UseAudioCaptureOptions {
  onChunk?: (chunk: AudioChunk) => void;
  onComplete?: (audio: {
    blob: Blob;
    base64: string;
    duration: number;
  }) => void;
  onError?: (error: Error) => void;
}

export interface UseAudioCaptureReturn {
  state: AudioCaptureState;
  permissionState: PermissionState | null;
  isRecording: boolean;
  duration: number;
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; base64: string } | null>;
  cancel: () => void;
  checkPermission: () => Promise<PermissionState>;
}

export function useAudioCapture(
  options: UseAudioCaptureOptions = {},
): UseAudioCaptureReturn {
  const { onChunk, onComplete, onError } = options;

  const [state, setState] = useState<AudioCaptureState>("idle");
  const [permissionState, setPermissionState] =
    useState<PermissionState | null>(null);
  const [duration, setDuration] = useState(0);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  // Update duration while recording
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state]);

  const checkPermission = useCallback(async (): Promise<PermissionState> => {
    const permission = await checkMicrophonePermission();
    setPermissionState(permission);
    return permission;
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const start = useCallback(async () => {
    if (state === "recording") return;

    setState("requesting");
    setDuration(0);

    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start(onChunk);
      startTimeRef.current = Date.now();
      setState("recording");
      setPermissionState("granted");
    } catch (error) {
      setState("error");
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);

      // Check if permission was denied
      if (err.name === "NotAllowedError") {
        setPermissionState("denied");
      }
    }
  }, [state, onChunk, onError]);

  const stop = useCallback(async (): Promise<{
    blob: Blob;
    base64: string;
  } | null> => {
    if (!recorderRef.current?.isRecording()) {
      return null;
    }

    try {
      const blob = await recorderRef.current.stop();
      const base64 = await blobToBase64(blob);
      const finalDuration = (Date.now() - startTimeRef.current) / 1000;

      setState("idle");
      setDuration(finalDuration);

      onComplete?.({ blob, base64, duration: finalDuration });

      return { blob, base64 };
    } catch (error) {
      setState("error");
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      return null;
    }
  }, [onComplete, onError]);

  const cancel = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    setState("idle");
    setDuration(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
    };
  }, []);

  return {
    state,
    permissionState,
    isRecording: state === "recording",
    duration,
    start,
    stop,
    cancel,
    checkPermission,
  };
}
