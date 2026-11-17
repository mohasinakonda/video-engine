/**
 * A product-review Short for Google Flow: one 8-second clip per selected product (up to 5, so up to
 * 40 seconds), each built on the creator's own photo of the product, with a voiceover read at about
 * 200 words a minute. Plus the SEO pack for the upload.
 */
import { z } from 'zod';
import type { FlowMode } from '../../youtube/next-shorts/models';
import { DOMAINS, type Domain } from '../types';

export const MAX_PRODUCTS = 5;
export const CLIP_SECONDS = 8;
/** About 200 wpm over 8 seconds is ~26 words; this range keeps it readable. */
export const VO_MIN_WORDS = 18;
export const VO_MAX_WORDS = 28;
export const ON_SCREEN_MAX_WORDS = 4;

const text = (max: number) => z.string().trim().min(1).max(max);

/** What the browser sends: the selected products. Their details are re-read on the server. */
export const videoRequestSchema = z.object({
  domain: z.enum(DOMAINS),
  model: z.enum(['omni', 'veo_lite']).default('omni'),
  /** The niche or search, for the hook and the video tag. */
  label: z.string().trim().min(1).max(80),
  products: z
    .array(
      z.object({
        asin: z.string().regex(/^[A-Z0-9]{10}$/),
        title: z.string().trim().min(1).max(300),
        // From the search list (same Canopy call), so the server doesn't read Amazon again.
        brand: z.string().trim().max(120).nullable().default(null),
        featureBullets: z.array(z.string().trim().max(1000)).max(8).default([]),
        imageUrl: z.string().url().max(1000).nullable().default(null),
      }),
    )
    .min(1)
    .max(MAX_PRODUCTS),
  notes: z.string().trim().max(400).optional(),
});
export type VideoRequest = z.infer<typeof videoRequestSchema>;

export const CAMERA_MOVES = ['none', 'push_in', 'pull_back', 'pan', 'orbit', 'tilt'] as const;

export const clipSchema = z.object({
  asin: z.string(),
  /** Short name for the video and on-screen text ("Mini Car Vacuum"). */
  productName: text(50),
  /** The start frame, made by editing the creator's photo: the product in use, in a real setting. */
  startImage: text(500),
  subject: text(200),
  /** One action, already happening in the first frame. */
  action: text(240),
  camera: z.object({ position: text(160), movement: z.enum(CAMERA_MOVES) }),
  setting: text(200),
  lighting: text(160),
  voiceover: text(260),
  onScreenText: z.string().trim().max(40),
});
export type Clip = z.infer<typeof clipSchema>;

export const videoScriptSchema = z.object({
  /** The first words of clip 1: why keep watching. */
  hook: text(120),
  look: text(300),
  voice: text(120),
  clips: z
    .array(clipSchema)
    .min(1)
    .max(MAX_PRODUCTS + 2),
});
export type VideoScript = z.infer<typeof videoScriptSchema>;

export interface ProductFacts {
  asin: string;
  title: string;
  brand: string | null;
  bullets: string[];
  imageUrl: string | null;
}

export interface VideoPack {
  version: 1;
  model: FlowMode;
  domain: Domain;
  label: string;
  /** A tag for the bio page link: bio.rendoza.com/@handle?q=<tag>. */
  videoTag: string;
  products: ProductFacts[];
  script: VideoScript;
  /** Rules still broken after one rewrite. */
  issues: string[];
  createdAt: string;
}

export const seoSchema = z.object({
  titles: z
    .array(z.object({ title: text(120), angle: text(120) }))
    .min(1)
    .max(6),
  thumbnail: z.object({ concept: text(300), imagePrompt: text(600), text: z.string().trim().max(40) }),
  description: text(1500),
  keywords: z.array(z.string().trim().min(2).max(60)).max(30),
  hashtags: z.array(z.string().trim().min(2).max(40)).max(6),
});
export type SeoPack = z.infer<typeof seoSchema> & { bioLink: string | null; createdAt: string };
