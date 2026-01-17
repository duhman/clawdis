/**
 * useGatewayVoice Hook
 * Integrates voice capture with the Clawdbot Gateway
 * Uses Web Speech API for transcription when available
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useVoiceTrigger, VoiceTriggerState } from "./useVoiceTrigger";
import type { GatewayClient } from "../lib/gateway/client";

// Web Speech API types (not in all TypeScript libs)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export type GatewayVoicePhase =
  | "idle"
  | "listening"
  | "transcribing"
  | "processing"
  | "speaking";

export interface UseGatewayVoiceOptions {
  /** Gateway client instance */
  client: GatewayClient | null;
  /** Session key for the chat */
  sessionKey?: string;
  /** Thinking level for chat.send */
  thinking?: "off" | "low" | "medium" | "high";
  /** Callback when transcription is complete */
  onTranscript?: (text: string) => void;
  /** Callback when response is received */
  onResponse?: (text: string) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseGatewayVoiceReturn {
  /** Current phase */
  phase: GatewayVoicePhase;
  /** Whether currently listening */
  isListening: boolean;
  /** Whether talk mode is enabled on gateway */
  talkModeEnabled: boolean;
  /** Current transcript (while transcribing) */
  transcript: string;
  /** Recording duration in seconds */
  duration: number;
  /** Start listening */
  start: () => Promise<void>;
  /** Stop listening and process */
  stop: () => Promise<void>;
  /** Cancel current operation */
  cancel: () => void;
  /** Toggle gateway talk mode */
  toggleTalkMode: (enabled: boolean) => Promise<void>;
  /** Whether speech recognition is supported */
  isSpeechRecognitionSupported: boolean;
}

// Check for SpeechRecognition support
function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as unknown as Record<string, unknown>;
  return (win.SpeechRecognition || win.webkitSpeechRecognition) as
    | SpeechRecognitionConstructor
    | undefined;
}

const SpeechRecognition = getSpeechRecognition();

export function useGatewayVoice(
  options: UseGatewayVoiceOptions,
): UseGatewayVoiceReturn {
  const {
    client,
    sessionKey = "default",
    thinking = "low",
    onTranscript,
    onResponse,
    onError,
  } = options;

  const [phase, setPhase] = useState<GatewayVoicePhase>("idle");
  const [talkModeEnabled, setTalkModeEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSpeechRecognitionSupported = !!SpeechRecognition;

  // Initialize speech recognition
  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultTranscript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += resultTranscript;
        } else {
          interimTranscript += resultTranscript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      onError?.(new Error(`Speech recognition error: ${event.error}`));
      setPhase("idle");
    };

    recognition.onend = () => {
      if (phase === "listening") {
        setPhase("transcribing");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [onError, phase]);

  const handleVoiceEnd = useCallback(
    async (audio: { blob: Blob; base64: string }) => {
      if (!client) {
        onError?.(new Error("Gateway client not connected"));
        return;
      }

      // If we have a transcript from speech recognition, use it
      const finalTranscript = transcript.trim();
      if (finalTranscript) {
        setPhase("processing");
        onTranscript?.(finalTranscript);

        try {
          const response = await client.request<{ content: string }>(
            "chat.send",
            {
              message: finalTranscript,
              sessionKey,
              thinking,
              stream: false,
            },
          );

          onResponse?.(response.content);
          setPhase("idle");
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error(String(error)));
          setPhase("idle");
        }
      } else {
        // No transcript - could send audio for server-side transcription
        // For now, just log and reset
        console.warn(
          "No transcript available, audio recorded:",
          audio.blob.size,
          "bytes",
        );
        setPhase("idle");
      }

      setTranscript("");
    },
    [
      client,
      transcript,
      sessionKey,
      thinking,
      onTranscript,
      onResponse,
      onError,
    ],
  );

  const voiceTrigger = useVoiceTrigger({
    mode: "push-to-talk",
    triggerKey: " ",
    minDuration: 0.5,
    maxDuration: 60,
    onStart: () => {
      setPhase("listening");
      setTranscript("");
      // Start speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // May already be started
        }
      }
    },
    onEnd: handleVoiceEnd,
    onError,
  });

  const start = useCallback(async () => {
    await voiceTrigger.startListening();
  }, [voiceTrigger]);

  const stop = useCallback(async () => {
    // Stop speech recognition first
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    await voiceTrigger.stopListening();
  }, [voiceTrigger]);

  const cancel = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    voiceTrigger.cancel();
    setPhase("idle");
    setTranscript("");
  }, [voiceTrigger]);

  const toggleTalkMode = useCallback(
    async (enabled: boolean) => {
      if (!client) {
        onError?.(new Error("Gateway client not connected"));
        return;
      }

      try {
        await client.request("talk.mode", { enabled });
        setTalkModeEnabled(enabled);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [client, onError],
  );

  // Map voice trigger state to phase
  useEffect(() => {
    const stateToPhase: Record<VoiceTriggerState, GatewayVoicePhase> = {
      idle: "idle",
      listening: "listening",
      processing: "processing",
    };

    if (phase !== "speaking" && phase !== "transcribing") {
      setPhase(stateToPhase[voiceTrigger.state]);
    }
  }, [voiceTrigger.state, phase]);

  return {
    phase,
    isListening: phase === "listening",
    talkModeEnabled,
    transcript,
    duration: voiceTrigger.duration,
    start,
    stop,
    cancel,
    toggleTalkMode,
    isSpeechRecognitionSupported,
  };
}
