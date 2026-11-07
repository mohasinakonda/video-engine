/**
 * What the browser sends to POST /api/viral-engine: still frames and measured numbers only.
 * The video file itself never leaves the user's computer.
 */
import { z } from 'zod';
import { RULES } from './rules-config';

/** One JPEG frame or contact sheet as a data URL, at most ~600 KB of base64. */
export const MAX_IMAGE_CHARS = 800_000;
/** The whole request, under the 4.5 MB serverless body limit. */
export const MAX_BODY_BYTES = 3_800_000;
/** Opening frames, sent at higher resolution because the first seconds matter most. */
export const HOOK_TIMES = [0, 0.5, 1, 1.5, 2, 3];
/** Contact sheets are 3×3 grids of body frames. */
export const SHEET_COLS = 3;
export const SHEET_ROWS = 3;
export const SHEET_CELLS = SHEET_COLS * SHEET_ROWS;

const jpeg = z
  .string()
  .max(MAX_IMAGE_CHARS)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, 'Frames must be JPEG images.');

const seconds = z.number().min(0).max(RULES.maxDurationSec + 1);

export const signalsSchema = z.object({
  durationSec: z.number().positive().max(RULES.maxDurationSec + 1),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
  letterboxed: z.boolean(),
  motionStep: z.number().min(0.1).max(2),
  motion: z.array(z.number().min(0).max(1)).max(2000),
  cuts: z.array(seconds).max(1000),
  loudnessStep: z.number().min(0.05).max(1),
  loudness: z.array(z.number().min(-100).max(10)).max(4000),
  clippingPct: z.number().min(0).max(100),
  loopSimilarity: z.number().min(0).max(1),
  speech: z.array(z.object({ start: seconds, end: seconds, text: z.string().max(2000) })).max(1000),
  speechLanguage: z.string().max(10).nullable(),
});

export const viralRequestSchema = z.object({
  file: z.object({
    name: z.string().max(300),
    size: z.number().int().nonnegative(),
    durationSec: z.number().positive().max(RULES.maxDurationSec + 1),
  }),
  hookFrames: z.array(z.object({ t: seconds, image: jpeg })).min(1).max(HOOK_TIMES.length),
  sheets: z.array(z.object({ image: jpeg, times: z.array(seconds).min(1).max(SHEET_CELLS) })).max(6),
  signals: signalsSchema,
  /** A link to the published Short, for its real retention (channel must be connected). */
  videoLink: z.string().trim().max(300).nullable(),
  /** Compare with the connected channel (its topics, its Shorts' length and retention). */
  useChannel: z.boolean().default(false),
  metadata: z.object({
    title: z.string().trim().max(300),
    hashtags: z.array(z.string().trim().max(80)).max(30),
  }),
});

export type ViralRequest = z.infer<typeof viralRequestSchema>;
