/**
 * useTTS Hook
 * React hook for text-to-speech functionality
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  TextToSpeech,
  TTSState,
  TTSOptions,
  TTSVoice,
  isTTSSupported,
  waitForVoices,
} from "../lib/voice/text-to-speech";

export interface UseTTSOptions extends TTSOptions {
  /** Auto-start speaking when text changes */
  autoSpeak?: boolean;
  /** Callback when speaking starts */
  onStart?: () => void;
  /** Callback when speaking ends */
  onEnd?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseTTSReturn {
  /** Current TTS state */
  state: TTSState;
  /** Whether currently speaking */
  isSpeaking: boolean;
  /** Whether TTS is supported */
  isSupported: boolean;
  /** Available voices */
  voices: TTSVoice[];
  /** Current text being spoken */
  currentText: string;
  /** Speak text */
  speak: (text: string) => Promise<void>;
  /** Pause speech */
  pause: () => void;
  /** Resume speech */
  resume: () => void;
  /** Stop speech */
  stop: () => void;
  /** Set voice */
  setVoice: (voice: string) => void;
  /** Set speech rate */
  setRate: (rate: number) => void;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const { autoSpeak = false, onStart, onEnd, onError, ...ttsOptions } = options;

  const [state, setState] = useState<TTSState>("idle");
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [currentText, setCurrentText] = useState("");

  const ttsRef = useRef<TextToSpeech | null>(null);
  const isSupported = isTTSSupported();

  // Initialize TTS
  useEffect(() => {
    if (!isSupported) return;

    const tts = new TextToSpeech(ttsOptions);
    tts.setOnStateChange((newState) => {
      setState(newState);
      if (newState === "speaking") {
        onStart?.();
      } else if (newState === "idle") {
        onEnd?.();
      }
    });
    ttsRef.current = tts;

    // Load voices
    waitForVoices().then(setVoices);

    return () => {
      tts.stop();
    };
  }, [isSupported]); // Only initialize once

  const speak = useCallback(
    async (text: string) => {
      if (!ttsRef.current) {
        onError?.(new Error("TTS not initialized"));
        return;
      }

      setCurrentText(text);
      try {
        await ttsRef.current.speak(text);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [onError],
  );

  const pause = useCallback(() => {
    ttsRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    ttsRef.current?.resume();
  }, []);

  const stop = useCallback(() => {
    ttsRef.current?.stop();
    setCurrentText("");
  }, []);

  const setVoice = useCallback((voice: string) => {
    ttsRef.current?.setOptions({ voice });
  }, []);

  const setRate = useCallback((rate: number) => {
    ttsRef.current?.setOptions({ rate });
  }, []);

  return {
    state,
    isSpeaking: state === "speaking",
    isSupported,
    voices,
    currentText,
    speak,
    pause,
    resume,
    stop,
    setVoice,
    setRate,
  };
}
