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
  /** Phase 2: export configuration settings */
  exportSettings?: ExportSettings;
  /** Phase 3: relative path to the rendered final MP4 video */
  finalVideoPath?: string;
  /** Scene cutting pace profile */
  pacingProfile?: PacingProfile;
  /** Custom uploaded voiceover audio filename */
  customAudioFileName?: string;
  /** Flag indicating whether project uses user-uploaded voiceover */
  hasCustomVoice?: boolean;
}

// ─── Phase 2: Pacing Profile ──────────────────────────────────────────────────

export type PacingProfile = 'fast' | 'balanced' | 'cinematic';

// ─── Phase 3: Export Types ───────────────────────────────────────────────────

export type ExportResolution = '1080p' | '4k';

export type HardwareEncoder = 'auto' | 'h264_nvenc' | 'h264_qsv' | 'h264_videotoolbox' | 'libx264';

export type TransitionType = 'crossfade' | 'fade_black' | 'cut';

export interface ExportSettings {
  resolution: ExportResolution;
  encoder: HardwareEncoder;
  bgmFilePath?: string;
  bgmVolume: number; // 0.0 to 1.0 (default 0.15)
  enableAutoDucking: boolean; // default true
  outputPath: string;
  transitionType?: TransitionType;
  transitionDurationSec?: number;
}

export type ExportStage =
  | 'idle'
  | 'audio_stitch'
  | 'video_concat'
  | 'final_render'
  | 'completed'
  | 'failed';

export interface ExportProgress {
  stage: ExportStage;
  percentage: number; // 0 - 100
  fps: number;
  frame: number;
  totalFrames: number;
  etaSeconds: number;
  currentStepMessage: string;
  error?: string;
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

export type ShotType =
  | 'AERIAL_GEOMETRY'    // Top-down drone, geography, landscape patterns
  | 'MACRO_TEXTURE'      // Micro details, water drops, rocks, flora/fauna textures
  | 'CULTURAL_HUMAN'     // People, artisans, daily life, rituals, culture
  | 'HISTORICAL_HERITAGE'// Ancient ruins, architecture, historical relics
  | 'ATMOSPHERIC_MOOD'   // Weather, fog, lighting transitions, ambient mood
  | 'WIDE_ESTABLISHING'; // Broad cinematic scene-setting landscape

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
  /** B-Roll classification for visual rhythm & variety */
  shotType?: ShotType;
  /** Short summary of the specific B-Roll focal motif */
  bRollFocus?: string;
  status: SceneStatus;
  error?: string;
  retryCount?: number;
}

