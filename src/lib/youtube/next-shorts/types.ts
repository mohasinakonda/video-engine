/**
 * Next Shorts: from a channel's own views check to a batch of new Shorts. Each Short is a
 * storyboard of separate shots (one subject, one action, one camera each), the reference images
 * that keep the shots consistent, an audio plan kept apart from the pictures, and packaging.
 */
import { z } from 'zod';
import type { FlowMode } from './models';
import type { Pace } from './pacing';
import type { ShortPackaging } from './packaging';

export type { FlowMode } from './models';

/** A Short is 15–30 seconds, never longer. */
export const MIN_SECONDS = 15;
export const MAX_SECONDS = 30;
export const MIN_SHOTS = 3;
export const MAX_SHOTS = 12;
/** How many Shorts a run can make. */
export const BATCH_SIZES = [3, 5, 10] as const;
/** Spoken words per second of video, at most: very few words. */
export const MAX_WORDS_PER_SECOND = 0.8;
/** On-screen text, added in editing. */
export const CAPTION_MAX_WORDS = 4;
export const TITLE_MAX = 60;
export const MAX_HASHTAGS = 3;

const text = (max: number) => z.string().trim().min(1).max(max);

// ─── Input: the slice of the views check the client sends ───────────────────

export const shortInputSchema = z.object({
  videoId: z.string().min(1).max(40),
  title: z.string().max(200),
  views: z.number().min(0),
  durationSec: z.number().min(0).max(600).nullable(),
  estSwipeAway: z.number().min(0).max(1).nullable(),
  avgViewPct: z.number().min(0).max(1000).nullable(),
  biggestDrop: z.object({ atSec: z.number().min(0), lost: z.number().min(0).max(1) }).nullable(),
  exitWindow: z.object({ fromSec: z.number().min(0), toSec: z.number().min(0).nullable() }).nullable(),
  topic: z.string().max(80).nullable().optional(),
});
export type ShortInput = z.infer<typeof shortInputSchema>;

export const requestSchema = z.object({
  count: z.union([z.literal(3), z.literal(5), z.literal(10)]),
  mode: z.enum(['omni', 'veo_lite']).default('omni'),
  pace: z.enum(['very_fast', 'fast', 'steady']).default('fast'),
  channelTitle: z.string().trim().min(1).max(120),
  shorts: z.array(shortInputSchema).min(3).max(50),
  /** Optional: anything the creator wants (a product, a series, a style). */
  notes: z.string().trim().max(500).optional(),
});
export type NextShortsRequest = z.infer<typeof requestSchema>;

/** Rewrite one Short of a saved batch: the same idea, a new storyboard (the browser sends the batch's context). */
export const rewriteRequestSchema = z.object({
  channelTitle: z.string().trim().min(1).max(120),
  mode: z.enum(['omni', 'veo_lite']),
  pace: z.enum(['very_fast', 'fast', 'steady']).default('fast'),
  style: z.object({ audience: text(200), look: text(500), voice: text(160) }),
  facts: z.array(z.string().max(300)).max(12),
  dropWall: z.number().min(0).max(60).nullable(),
  short: z.object({
    id: z.string().min(1).max(12),
    name: text(80),
    basedOn: z.string().max(40).nullable(),
    basedOnTitle: z.string().max(200).nullable(),
    why: text(240),
    /** The last version's shots, so the new one is different. */
    previousShots: z.array(z.string().max(300)).max(12),
  }),
  /** What the creator wants changed. */
  feedback: z.string().trim().max(500).optional(),
});
export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

// ─── What the data says ─────────────────────────────────────────────────────

export interface ShortStat {
  videoId: string;
  title: string;
  views: number;
  durationSec: number | null;
  swipeAway: number | null;
  watchedPct: number | null;
  dropAtSec: number | null;
  topic: string | null;
}

export interface Insights {
  /** Shorts judged (with a swipe-away reading). */
  shorts: number;
  /** Best first: lowest swipe away, then most watched. */
  winners: ShortStat[];
  /** Worst first. */
  losers: ShortStat[];
  /** The second most Shorts lose the most viewers at, when most of them share it. */
  dropWall: { atSec: number; shorts: number } | null;
  /** Shorts watched more than once on average (over 100%). */
  rewatched: ShortStat[];
  /** Typical % watched of Shorts up to 30s vs longer. */
  byLength: { short: number | null; long: number | null };
  typicalSwipeAway: number | null;
  bestTopic: string | null;
  /** Plain English lines for the creator and the AI. */
  lines: string[];
}

// ─── Output: the AI's ideas and scripts ─────────────────────────────────────

export const styleSchema = z.object({
  audience: text(200),
  /** Look shared by every Short: setting, light, camera, subject. */
  look: text(500),
  voice: text(160),
});
export type FlowStyle = z.infer<typeof styleSchema>;

export const ideaSchema = z.object({
  name: text(80),
  /** The channel Short it builds on. */
  basedOn: z.string().max(40).nullable(),
  why: text(240),
});
export type ShortIdea = z.infer<typeof ideaSchema>;

export const CAMERA_MOVES = ['none', 'push_in', 'pull_back', 'pan', 'tilt', 'track', 'orbit'] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];
export const CONTINUITY_KINDS = ['exact_frame', 'visual', 'temporal', 'none'] as const;
export const ASSET_KINDS = ['base_plate', 'state', 'product', 'character', 'environment'] as const;

/** An image the creator makes (or brings) before the shots: it keeps them consistent. */
export const assetSchema = z.object({
  id: z.string().trim().min(1).max(12),
  kind: z.enum(ASSET_KINDS),
  /** For state images: the condition it shows ("stained", "clean"). */
  state: z.string().trim().max(60).nullable(),
  /** The image prompt, or for the creator's own product photo, what it must show. */
  description: text(600),
  /** Made by editing this image, so the object stays the same. */
  editOf: z.string().trim().max(12).nullable(),
  /** The creator's own photo (their product), not generated. */
  fromCreator: z.boolean(),
});
export type Asset = z.infer<typeof assetSchema>;

export const shotSchema = z.object({
  title: text(60),
  purpose: text(200),
  subject: text(200),
  /** One physical action. */
  action: text(240),
  stateBefore: z.string().trim().max(60).nullable(),
  stateAfter: z.string().trim().max(60).nullable(),
  camera: z.object({ position: text(160), movement: z.enum(CAMERA_MOVES) }),
  environment: text(200),
  lighting: text(160),
  composition: text(160),
  continuity: z.object({
    /** Shot number (1-based) this one continues from. */
    with: z.number().int().min(1).max(MAX_SHOTS).nullable(),
    kind: z.enum(CONTINUITY_KINDS),
    keep: z.array(text(80)).max(6),
  }),
  references: z.array(z.object({ asset: z.string().trim().max(12), preserve: z.array(text(80)).min(1).max(6) })).max(3),
  startFrame: z.string().trim().max(12).nullable(),
  endFrame: z.string().trim().max(12).nullable(),
  /** Screen time, after any speed change. */
  seconds: z.number().int().min(1).max(10),
  speed: z.enum(['real_time', 'fast_forward', 'speed_ramp', 'slow_motion']).default('real_time'),
  /** Optional, one line; detailed sound goes in the audio plan. */
  ambient: z.string().trim().max(120).nullable(),
});
export type Shot = z.infer<typeof shotSchema>;

export const audioPlanSchema = z.object({
  voiceover: z.array(z.object({ shot: z.number().int().min(1), text: text(120) })).max(6),
  sfx: z.array(z.object({ shot: z.number().int().min(1), sound: text(100) })).max(12),
  ambient: z.string().trim().max(160).nullable(),
  music: z.string().trim().max(160).nullable(),
});
export type AudioPlan = z.infer<typeof audioPlanSchema>;

export const storyboardSchema = z.object({
  brief: z.object({ promise: text(200), hook: text(240), ending: text(240) }),
  assets: z.array(assetSchema).max(6),
  shots: z
    .array(shotSchema)
    .min(1)
    .max(MAX_SHOTS + 2),
  audio: audioPlanSchema,
  captions: z.array(z.object({ shot: z.number().int().min(1), text: text(60) })).max(8),
  packaging: z.object({
    title: text(100),
    description: text(300),
    hashtags: z.array(z.string().trim().min(2).max(40)).max(6),
    /** Shot number whose frame makes the best cover. */
    coverShot: z.number().int().min(1),
  }),
});
export type Storyboard = z.infer<typeof storyboardSchema>;

export interface Issue {
  /** 1-based shot number, or null for the whole Short. */
  shot: number | null;
  level: 'block' | 'warn';
  message: string;
}

export interface ShotReport {
  shot: number;
  startsAt: number;
  /** How hard the shot is to generate, 0–100 (higher is harder). */
  complexity: number;
  complexityReasons: string[];
  /** How ready the prompt is, 0–100: not a promise about the video. */
  readiness: number;
  readinessReasons: string[];
  generation: { seconds: number; trim: number } | null;
}

export interface NextShort extends ShortIdea {
  id: string;
  basedOnTitle: string | null;
  storyboard: Storyboard;
  seconds: number;
  voiceWords: number;
  shots: ShotReport[];
  readiness: number;
  /** Fixes made without a rewrite (an end frame that contradicted the shot, a missing asset). */
  fixes: string[];
  /** What still needs the creator's eye. */
  issues: Issue[];
  /** Full packaging, written on request in the browser and kept with the ideas. */
  packagingOptions?: ShortPackaging;
  packagingAt?: string;
  /** When the creator last had this Short rewritten. */
  rewrittenAt?: string;
}

export interface NextShortsPack {
  version: 3;
  mode: FlowMode;
  /** Missing on batches made before pacing: read as 'fast'. */
  pace?: Pace;
  channelTitle: string;
  insights: Insights;
  style: FlowStyle;
  shorts: NextShort[];
  /** For Flow's project "Agent Instructions": the standing rules for every Short. */
  flowInstruction: string;
  generatedAt: string;
}
