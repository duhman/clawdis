/**
 * Text-to-Speech Utilities
 * Uses Web Speech Synthesis API
 */

export type TTSState = "idle" | "speaking" | "paused";

export interface TTSOptions {
  /** Voice name or language code */
  voice?: string;
  /** Speech rate (0.1 to 10, default: 1) */
  rate?: number;
  /** Pitch (0 to 2, default: 1) */
  pitch?: number;
  /** Volume (0 to 1, default: 1) */
  volume?: number;
}

export interface TTSVoice {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/**
 * Check if TTS is supported
 */
export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Get available voices
 */
export function getVoices(): TTSVoice[] {
  if (!isTTSSupported()) return [];

  return window.speechSynthesis.getVoices().map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
    default: voice.default,
  }));
}

/**
 * Wait for voices to be loaded
 */
export async function waitForVoices(): Promise<TTSVoice[]> {
  if (!isTTSSupported()) return [];

  return new Promise((resolve) => {
    const voices = getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Voices may be loaded asynchronously
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(getVoices());
    };

    // Timeout fallback
    setTimeout(() => {
      resolve(getVoices());
    }, 1000);
  });
}

/**
 * Find a voice by name or language
 */
export function findVoice(
  nameOrLang: string,
): SpeechSynthesisVoice | undefined {
  if (!isTTSSupported()) return undefined;

  const voices = window.speechSynthesis.getVoices();

  // Try exact name match first
  const byName = voices.find(
    (v) => v.name.toLowerCase() === nameOrLang.toLowerCase(),
  );
  if (byName) return byName;

  // Try language match
  const byLang = voices.find((v) =>
    v.lang.toLowerCase().startsWith(nameOrLang.toLowerCase()),
  );
  if (byLang) return byLang;

  // Try partial name match
  const byPartial = voices.find((v) =>
    v.name.toLowerCase().includes(nameOrLang.toLowerCase()),
  );
  return byPartial;
}

/**
 * TextToSpeech class for managing speech synthesis
 */
export class TextToSpeech {
  private utterance: SpeechSynthesisUtterance | null = null;
  private options: Required<TTSOptions>;
  private onStateChange?: (state: TTSState) => void;
  private onProgress?: (charIndex: number, text: string) => void;

  constructor(options: TTSOptions = {}) {
    this.options = {
      voice: options.voice ?? "en-US",
      rate: options.rate ?? 1,
      pitch: options.pitch ?? 1,
      volume: options.volume ?? 1,
    };
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback: (state: TTSState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Set progress callback
   */
  setOnProgress(callback: (charIndex: number, text: string) => void): void {
    this.onProgress = callback;
  }

  /**
   * Speak text
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isTTSSupported()) {
        reject(new Error("Text-to-speech not supported"));
        return;
      }

      // Cancel any current speech
      this.stop();

      this.utterance = new SpeechSynthesisUtterance(text);

      // Find and set voice
      const voice = findVoice(this.options.voice);
      if (voice) {
        this.utterance.voice = voice;
      }

      this.utterance.rate = this.options.rate;
      this.utterance.pitch = this.options.pitch;
      this.utterance.volume = this.options.volume;

      this.utterance.onstart = () => {
        this.onStateChange?.("speaking");
      };

      this.utterance.onend = () => {
        this.onStateChange?.("idle");
        resolve();
      };

      this.utterance.onerror = (event) => {
        this.onStateChange?.("idle");
        if (event.error !== "interrupted") {
          reject(new Error(`TTS error: ${event.error}`));
        } else {
          resolve();
        }
      };

      this.utterance.onpause = () => {
        this.onStateChange?.("paused");
      };

      this.utterance.onresume = () => {
        this.onStateChange?.("speaking");
      };

      this.utterance.onboundary = (event) => {
        this.onProgress?.(event.charIndex, text);
      };

      window.speechSynthesis.speak(this.utterance);
    });
  }

  /**
   * Pause speech
   */
  pause(): void {
    if (isTTSSupported()) {
      window.speechSynthesis.pause();
    }
  }

  /**
   * Resume speech
   */
  resume(): void {
    if (isTTSSupported()) {
      window.speechSynthesis.resume();
    }
  }

  /**
   * Stop speech
   */
  stop(): void {
    if (isTTSSupported()) {
      window.speechSynthesis.cancel();
      this.onStateChange?.("idle");
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return isTTSSupported() && window.speechSynthesis.speaking;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return isTTSSupported() && window.speechSynthesis.paused;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<TTSOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
