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
  /** Phase 2: customized style prompt for image generation */
  customStylePrompt?: string;
  /** Phase 2: customized negative style prompt */
  customNegativePrompt?: string;
  /** Phase 2: project-level aspect ratio */
  aspectRatio?: '16:9' | '9:16' | '1:1';
  /** Phase 2: chosen AI image generation model */
  imageModel?: string;
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
  /** Phase 3: AI YouTube and social media packaging kit */
  youtubePackaging?: YouTubePackagingData;
  /** Phase 2: Visual Story World Bible (historical era, environment, costumes, character anchors) */
  visualWorldBible?: VisualWorldBible;
}

// ─── Visual Story World Bible (Two-Stage AI Director) ──────────────────────────

export interface CharacterVisualAnchor {
  name: string;
  role: string;
  visualAnchor: string;
}

export interface VisualWorldBible {
  summary: string;
  eraAndSetting: string;
  geographyAndEnvironment: string;
  culturalContextAndCostumes: string;
  characters: CharacterVisualAnchor[];
  colorPaletteAndLighting: string;
  strictAnachronismBans: string;
  videoTopicAndMotive?: string;
  coreSubjectOrProtagonist?: string;
}

// ─── Phase 2: Pacing Profile ──────────────────────────────────────────────────

export type PacingProfile = 'fast' | 'balanced' | 'cinematic' | 'documentary' | 'transcript';

export type VisualSceneType = 'HERO_AI' | 'STOCK_BROLL' | 'MOTION_GRAPHIC';
export type CameraMotionEffect = 'ZOOM_IN' | 'ZOOM_OUT' | 'PAN_LEFT' | 'PAN_RIGHT' | 'STATIC';

// ─── Phase 3: Export Types ───────────────────────────────────────────────────

export type ExportResolution = '720p' | '1080p' | '4k';

export type HardwareEncoder = 'auto' | 'h264_nvenc' | 'h264_qsv' | 'h264_videotoolbox' | 'libx264';

export type TransitionType = 'crossfade' | 'fade_black' | 'cut' | 'slide_left' | 'fade_to_black' | 'none';

export interface ExportSettings {
  resolution: ExportResolution;
  encoder: HardwareEncoder;

  outputPath: string;
  transitionType?: TransitionType;
  transitionDurationSec?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  bgmFilePath?: string;
  bgmVolume?: number;
  enableAutoDucking?: boolean;
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
  aspectRatio: '16:9' | '9:16' | '1:1';
  isDefault: boolean;
  /** True = shipped with the app, cannot be deleted */
  isBuiltIn?: boolean;
  createdAt: number;
  /** Visual preview thumbnail image URL */
  thumbnailUrl?: string;
  /** Primary movement/family ID (e.g. 'cinematic', 'printmaking') */
  familyId?: string;
  /** Short descriptive tag (e.g. 'Warm 1970s Cinema') */
  tag?: string;
  /** Extended aesthetic description */
  description?: string;
  /** Active status (controlled via Admin) */
  isActive?: boolean;
  /** Sort order for display hierarchy */
  sortOrder?: number;
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

export type CutPace = 'FAST_CUT' | 'NORMAL' | 'ATMOSPHERIC_HOLD';

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
  /** Dynamic directorial pacing decision */
  cutPace?: CutPace;
  /** Hybrid visual classification: Hero AI Image, Real Stock B-Roll, or Editorial Motion Graphic */
  visualType?: VisualSceneType;
  /** Cinematic 2.5D camera movement (Ken Burns zoom/pan) */
  cameraMotion?: CameraMotionEffect;
  status: SceneStatus;
  error?: string;
  retryCount?: number;
}

// ─── Phase 3: YouTube & Social Launch Kit ─────────────────────────────────────

export type HookStyle =
  | 'Curiosity Gap'
  | 'Search / SEO'
  | 'High Emotion'
  | 'Story / Drama'
  | 'Action / Bold';

export interface TitleOption {
  title: string;
  hookStyle: HookStyle;
  ctrScore?: number;
  whyItWorks?: string;
  charCount?: number;
  pairedConceptId?: string;
}

export interface ChapterItem {
  time: string; // e.g. "00:00"
  title: string;
  seconds: number;
}

export interface ThumbnailConcept {
  id: string;
  conceptName: string;
  visualPrompt: string;
  originalPrompt?: string;
  textOverlayHint: string;
  customBadgeText?: string;
  badgePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'center';
  badgeColor?: 'yellow' | 'red' | 'white' | 'cyan';
  visualHook?: string;
  compositionType?: 'split_contrast' | 'focal_close_up' | 'cinematic_scale' | 'custom';
  imageUrl?: string;
  isGenerating?: boolean;
  canvaDesignId?: string;
  canvaEditUrl?: string;
}

export interface ShortsRepurposeIdea {
  timestamp: string;
  hook: string;
  reason: string;
}

export interface ScriptIntelligence {
  coreTopic: string;
  narrativeSummary: string;
  keyTalkingPoints: string[];
  targetAudience: string;
  searchKeywords: string[];
  hookRetentionScore?: number;
  hookAnalysis?: string;
  suggestedPowerHook?: string;
  emotionalTriggers?: string[];
  viralAngles?: string[];
  shortsIdeas?: ShortsRepurposeIdea[];
  competitorGap?: string;
}

export interface CompetitorVideo {
  id: string;
  title: string;
  channel: string;
  views: string;
  thumbnail: string;
  videoUrl: string;
}

export interface MarketInsight {
  competitorVideos: CompetitorVideo[];
  packagingStrategy: string;
  marketSearchQuery?: string;
  alternativeSearchQueries?: string[];
}

export interface YouTubePackagingData {
  scriptIntelligence?: ScriptIntelligence;
  marketInsights?: MarketInsight;
  customTopicPrompt?: string;
  titles: TitleOption[];
  selectedTitleIndex?: number;
  description: string;
  chapters: ChapterItem[];
  tags: string[];
  hashtags: string[];
  thumbnailConcepts: ThumbnailConcept[];
  selectedThumbnailUrl?: string;
  generatedAt?: number;
  remainingCredits?: number;
}

export type { AIImageModel } from './subscription';


