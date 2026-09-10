// ─── Voice Preset ────────────────────────────────────────────────────────────

export interface VoicePreset {
  id: string;
  name: string;
  /** Supported Gemini voices: Aoede, Charon, Fenrir, Kore, Puck, etc. */
  voiceCharacter: string;
  /** Environmental baseline — e.g. "A quiet, professional remote workspace." */
  scene: string;
  /** Stylistic delivery entry point — e.g. "Calm, unhurried. Tone is empathetic." */
  sampleContext: string;
  /** 0.75 – 1.50, step 0.05 */
  pace: number;
  /** e.g. "American English" | "British English" | "Neutral Global" */
  accent: string;
  isDefault: boolean;
  createdAt: number;
}

// ─── Audio Chunk ─────────────────────────────────────────────────────────────

export type ChunkStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AudioChunk {
  index: number;
  /** Relative path within AppLocalDataDir */
  filePath: string;
  /** Exact duration in milliseconds (set after generation) */
  durationMs: number;
  status: ChunkStatus;
  /** Raw script text for this chunk */
  text: string;
  /** Temporary blob URL for in-app playback (not persisted) */
  audioUrl?: string;
  /** Error message if status === 'FAILED' */
  error?: string;
  /** Number of retry attempts */
  retryCount?: number;
}

// ─── Project Manifest ─────────────────────────────────────────────────────────

export interface ProjectManifest {
  projectId: string;
  title: string;
  rawScript: string;
  voicePresetId: string;
  audioChunks: AudioChunk[];
  /** Total duration in milliseconds (sum of all completed chunks) */
  totalDurationMs: number;
  updatedAt: number;
}

// ─── API Key Status ───────────────────────────────────────────────────────────

export type ApiKeyStatus = 'idle' | 'testing' | 'valid' | 'invalid' | 'quota_exceeded' | 'error';

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  geminiApiKey: string;
  apiKeyStatus: ApiKeyStatus;
}
