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
  /** Phase 2: scenes generated from the script */
  scenes?: SceneItem[];
  /** Phase 2: the selected base style preset ID */
  baseStylePresetId?: string;
}

// ─── API Key Status ───────────────────────────────────────────────────────────

export type ApiKeyStatus = 'idle' | 'testing' | 'valid' | 'invalid' | 'quota_exceeded' | 'error';

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  geminiApiKey: string;
  apiKeyStatus: ApiKeyStatus;
}

// ─── Phase 2: Base Style Preset ───────────────────────────────────────────────

export interface BaseStylePreset {
  id: string;
  /** e.g. "Dark Cinematic Documentary" */
  name: string;
  /** e.g. "Photorealistic, cinematic lighting, 8k resolution, muted colors..." */
  stylePrompt: string;
  /** e.g. "cartoon, blurry, distorted faces, low resolution" */
  negativePrompt?: string;
  aspectRatio: '16:9' | '9:16';
  isDefault: boolean;
  /** True = shipped with the app, cannot be deleted */
  isBuiltIn?: boolean;
  createdAt: number;
}

// ─── Phase 2: Motion Profile ─────────────────────────────────────────────────

export type MotionProfile = 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right';

// ─── Phase 2: Scene Status ────────────────────────────────────────────────────

export type SceneStatus =
  | 'PENDING'
  | 'GENERATING_IMAGE'
  | 'IMAGE_READY'
  | 'GENERATING_MOTION'
  | 'MOTION_READY'
  | 'FAILED';

// ─── Phase 2: Scene Item ──────────────────────────────────────────────────────

export interface SceneItem {
  /** 1-indexed scene number */
  sceneId: number;
  /** Start time in seconds relative to total audio */
  audioStartSec: number;
  /** End time in seconds */
  audioEndSec: number;
  /** The narration text for this scene window */
  narrationLine: string;
  /** Scene-specific visual description from Gemini */
  visualPrompt: string;
  /** Combined prompt: visualPrompt + stylePrompt */
  fullPrompt?: string;
  /** Relative path to the generated image: projects/{id}/scenes/scene_{n}.jpg */
  imagePath?: string;
  /** Temporary blob/data URL for in-app preview (not persisted) */
  imageUrl?: string;
  /** Relative path to the motion clip: projects/{id}/motion_clips/clip_{n}.mp4 */
  motionClipPath?: string;
  /** Randomly assigned motion effect */
  motionProfile?: MotionProfile;
  status: SceneStatus;
  error?: string;
  retryCount?: number;
}
