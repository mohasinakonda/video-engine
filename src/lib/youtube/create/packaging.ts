/**
 * Packaging v1 (docs/create-plan.md §9): title and thumbnail concepts, the user's choice, and
 * the metadata draft. Shared by the AI packager, the API and the editor (no server imports).
 */
import { z } from 'zod';
import { MECHANISMS, titleMechanisms, type TitleMechanism } from '../discover/formats';
import { FLOW } from './project-state';
import type { ProjectStatus } from './types';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);

/** YouTube's hard limit; past about 70 characters a title is cut off in most places. */
export const TITLE_MAX = 100;
export const TITLE_VISIBLE = 70;
/** YouTube's limits for descriptions and the combined length of tags. */
export const DESCRIPTION_MAX = 5000;
export const TAGS_MAX_CHARS = 500;
/** Thumbnail text is read at a glance; more words than this rarely work. */
export const THUMB_TEXT_WORDS = 4;

export const RISKS = ['low', 'medium', 'high'] as const;

export const titleConceptSchema = z.object({
  title: required(TITLE_MAX),
  mechanism: z.enum(MECHANISMS),
  /** Who this wording speaks to. */
  audience: text(160),
  /** How far the title could overpromise compared with the video. */
  risk: z.enum(RISKS),
  rationale: text(300),
  source: z.enum(['ai', 'manual']),
});
export type TitleConcept = z.infer<typeof titleConceptSchema>;

export const thumbnailConceptSchema = z.object({
  mainSubject: required(200),
  supportingObject: text(200),
  composition: text(240),
  emotionOrAction: text(200),
  background: text(200),
  /** Words on the thumbnail; may be empty. */
  text: text(40),
  contrast: text(200),
  hierarchy: text(240),
  source: z.enum(['ai', 'manual']),
  /** The made image, kept in this browser only (media never reaches our servers). */
  imageId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).optional(),
  /** The Canva design it's being edited in. */
  canvaDesignId: z.string().regex(/^[A-Za-z0-9_-]{4,100}$/).optional(),
});
export type ThumbnailConcept = z.infer<typeof thumbnailConceptSchema>;

export const packagingSchema = z
  .object({
    version: z.literal(1),
    language: z.enum(['English', 'Bangla']),
    titles: z.array(titleConceptSchema).max(10),
    thumbnails: z.array(thumbnailConceptSchema).max(6),
    selectedTitle: z.number().int().min(0).nullable(),
    selectedThumbnail: z.number().int().min(0).nullable(),
    description: text(DESCRIPTION_MAX),
    tags: z.array(required(60)).max(30),
    /** The script this packaging was made from; a newer script means it needs review. */
    scriptUpdatedAt: z.string(),
    source: z.enum(['ai', 'manual']),
    updatedAt: z.string(),
  })
  .refine((p) => p.selectedTitle === null || p.selectedTitle < p.titles.length, { message: 'selected title is missing', path: ['selectedTitle'] })
  .refine((p) => p.selectedThumbnail === null || p.selectedThumbnail < p.thumbnails.length, { message: 'selected thumbnail is missing', path: ['selectedThumbnail'] })
  .refine((p) => p.tags.join(',').length <= TAGS_MAX_CHARS, { message: `tags are longer than ${TAGS_MAX_CHARS} characters in total`, path: ['tags'] });
export type VideoPackaging = z.infer<typeof packagingSchema>;

/** Packaging is done when one title and one thumbnail are chosen. */
export const isComplete = (p: VideoPackaging) => p.selectedTitle !== null && p.selectedThumbnail !== null;

/** What's still needed before the step counts as done. */
export function missingForPackaged(p: VideoPackaging): string[] {
  const out: string[] = [];
  if (p.selectedTitle === null) out.push('choose a title');
  if (p.selectedThumbnail === null) out.push('choose a thumbnail');
  return out;
}

const rank = (s: ProjectStatus) => FLOW.indexOf(s);

/**
 * Status after saving packaging. A complete choice moves to PACKAGED; an incomplete one is
 * saved without finishing the step (and un-finishes it if it was done). Null when packaging
 * can't be edited yet: the script isn't saved.
 */
export function statusAfterPackaging(current: ProjectStatus, complete: boolean): ProjectStatus | null {
  if (current === 'ARCHIVED' || rank(current) < rank('SCRIPT_READY')) return null;
  return complete ? 'PACKAGED' : 'SCRIPT_READY';
}

/** The mechanism the wording actually uses; falls back to what was claimed. */
export function mechanismOf(title: string, claimed: TitleMechanism): TitleMechanism {
  const found = titleMechanisms(title);
  return found.length === 0 || found.includes(claimed) ? claimed : found[0];
}

/** Tags cleaned up: trimmed, no '#', no duplicates, within YouTube's total length. */
export function cleanTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.replace(/^#+/, '').replace(/[<>,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key) || [...out, tag].join(',').length > TAGS_MAX_CHARS) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.slice(0, 30);
}

export const wordsIn = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Empty packaging for writing by hand. */
export function emptyPackaging(language: VideoPackaging['language'], scriptUpdatedAt: string, now = new Date()): VideoPackaging {
  return {
    version: 1,
    language,
    titles: [],
    thumbnails: [],
    selectedTitle: null,
    selectedThumbnail: null,
    description: '',
    tags: [],
    scriptUpdatedAt,
    source: 'manual',
    updatedAt: now.toISOString(),
  };
}

export const blankTitle = (): TitleConcept => ({ title: '', mechanism: 'question', audience: '', risk: 'low', rationale: '', source: 'manual' });

export const blankThumbnail = (): ThumbnailConcept => ({
  mainSubject: '',
  supportingObject: '',
  composition: '',
  emotionOrAction: '',
  background: '',
  text: '',
  contrast: '',
  hierarchy: '',
  source: 'manual',
});

export const THUMBNAIL_FIELDS: { key: Exclude<keyof ThumbnailConcept, 'source' | 'imageId' | 'canvaDesignId'>; label: string }[] = [
  { key: 'mainSubject', label: 'Main subject' },
  { key: 'supportingObject', label: 'Supporting object' },
  { key: 'emotionOrAction', label: 'Emotion or action' },
  { key: 'composition', label: 'Composition' },
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text on the thumbnail' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'hierarchy', label: 'What the eye sees first' },
];

/** Plain text of the chosen package, for copying or downloading with the script. */
export function packagingToText(p: VideoPackaging): string {
  const title = p.selectedTitle !== null ? p.titles[p.selectedTitle] : null;
  const thumb = p.selectedThumbnail !== null ? p.thumbnails[p.selectedThumbnail] : null;
  const lines = ['## Title', title?.title ?? '(not chosen yet)', ''];
  lines.push('## Thumbnail');
  if (thumb) THUMBNAIL_FIELDS.forEach((f) => thumb[f.key] && lines.push(`- ${f.label}: ${thumb[f.key]}`));
  else lines.push('(not chosen yet)');
  lines.push('', '## Description', p.description || '(empty)', '', '## Tags', p.tags.join(', ') || '(none)');
  return lines.join('\n') + '\n';
}

/** Thumbnail text the image model can draw: Latin letters only (it can't write Bangla). */
export const drawableText = (text: string) => /^[A-Za-zÀ-ɏ\d\s!?'’&:,.-]+$/.test(text.trim());

/**
 * An image prompt from a thumbnail idea. Text the model can't draw is left out, to be added in
 * Canva instead.
 */
export function thumbnailPrompt(c: ThumbnailConcept, options: { anyText?: boolean } = {}): { prompt: string; textLeftOut: boolean } {
  const text = c.text.trim();
  // anyText: for a copied prompt, since other image models (e.g. Nano Banana) can write non-Latin scripts.
  const draw = !!text && (options.anyText || drawableText(text));
  // The text goes early, not last: the image route strips a closing quote, and FLUX weighs early words most.
  // "text reading" is the phrase the route looks for to stop asking the model for no text.
  const textPart = draw
    ? `Bold, large, easy-to-read headline text reading "${text}"`
    : text
      ? 'Clear empty space for a headline added later. No text or letters in the image'
      : 'No text or letters in the image';
  const parts = [
    'YouTube thumbnail, 16:9',
    c.mainSubject,
    c.supportingObject && `with ${c.supportingObject}`,
    textPart,
    c.emotionOrAction,
    c.composition && `Composition: ${c.composition}`,
    c.background && `Background: ${c.background}`,
    c.contrast,
  ];
  return { prompt: parts.filter(Boolean).join('. ').replace(/\.\./g, '.'), textLeftOut: !!text && !draw };
}
