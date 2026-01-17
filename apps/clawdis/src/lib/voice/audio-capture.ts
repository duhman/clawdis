/**
 * Audio Capture Utilities
 * Handles microphone access and audio recording
 */

export interface AudioCaptureConfig {
  sampleRate?: number;
  channelCount?: number;
  mimeType?: string;
}

export interface AudioChunk {
  blob: Blob;
  timestamp: number;
}

export type AudioCaptureState = "idle" | "requesting" | "recording" | "error";

const DEFAULT_CONFIG: Required<AudioCaptureConfig> = {
  sampleRate: 16000,
  channelCount: 1,
  mimeType: "audio/webm;codecs=opus",
};

/**
 * Request microphone permission and return the media stream
 */
export async function requestMicrophoneAccess(): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Check if microphone permission is granted
 */
export async function checkMicrophonePermission(): Promise<PermissionState> {
  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state;
  } catch {
    // Fallback for browsers that don't support permission query
    return "prompt";
  }
}

/**
 * Create an AudioContext for processing
 */
export function createAudioContext(
  config: AudioCaptureConfig = {},
): AudioContext {
  const { sampleRate } = { ...DEFAULT_CONFIG, ...config };
  return new AudioContext({ sampleRate });
}

/**
 * AudioRecorder class for managing recording sessions
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private config: Required<AudioCaptureConfig>;
  private onChunk?: (chunk: AudioChunk) => void;

  constructor(config: AudioCaptureConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start recording from the microphone
   */
  async start(onChunk?: (chunk: AudioChunk) => void): Promise<void> {
    this.onChunk = onChunk;
    this.chunks = [];

    this.stream = await requestMicrophoneAccess();

    const options: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported(this.config.mimeType)) {
      options.mimeType = this.config.mimeType;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
        if (this.onChunk) {
          this.onChunk({
            blob: event.data,
            timestamp: Date.now(),
          });
        }
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms for streaming
  }

  /**
   * Stop recording and return the complete audio blob
   */
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || this.config.mimeType,
        });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.onerror = (event) => {
        this.cleanup();
        reject(new Error(`Recording error: ${event}`));
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel recording without returning audio
   */
  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
    this.onChunk = undefined;
  }
}

/**
 * Convert audio blob to base64 for transmission
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix if present
      const base64Data = base64.split(",")[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get audio duration from blob
 */
export async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      resolve(0);
    };
  });
}
