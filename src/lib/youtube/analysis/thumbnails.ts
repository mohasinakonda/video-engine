import { z } from 'zod';
import { parseJsonObject } from '@/lib/llm-providers';
import { mapLimit } from '../fetcher';
import type { Confidence, Evidence, VideoAnalysis } from '../types';
import { round } from './stats';

/** What the vision model reports about one thumbnail. Validated before use. */
export const thumbnailSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  subjectSizePct: z.number().min(0).max(100),
  faceVisible: z.boolean(),
  textOnImage: z.string().max(120).nullable(),
  wordCount: z.number().int().min(0).max(40),
  contrast: z.enum(['low', 'medium', 'high']),
  background: z.enum(['simple', 'moderate', 'busy']),
  readableAtSmallSize: z.boolean(),
});
export type ThumbnailFindings = z.infer<typeof thumbnailSchema>;

export interface ThumbnailResult {
  videoId: string;
  group: 'top' | 'weak';
  findings: ThumbnailFindings | null;
  model: string | null;
}

const PROMPT = `You are reviewing one YouTube thumbnail. Describe only what is visible. Do not guess the video's topic or performance.
Reply with JSON only, exactly these keys:
{"subject": "<main subject in a few words>",
 "subjectSizePct": <percent of the image the main subject fills, 0-100>,
 "faceVisible": <true if a human face is clearly visible>,
 "textOnImage": "<the text written on the image, or null if none>",
 "wordCount": <number of words written on the image>,
 "contrast": "low" | "medium" | "high",
 "background": "simple" | "moderate" | "busy",
 "readableAtSmallSize": <true if the subject and any text would still be clear at phone-feed size>}`;

const ALLOWED_THUMBNAIL_HOSTS = new Set(['i.ytimg.com', 'i9.ytimg.com']);

/** Only YouTube's own image host is sent to the model (no arbitrary outbound URLs). */
export function isAllowedThumbnailUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_THUMBNAIL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export async function describeThumbnail(url: string, models: string[]): Promise<{ findings: ThumbnailFindings; model: string } | null> {
  const key = process.env.DEEPINFRA_API_KEY?.trim();
  if (!key) return null;

  for (const model of models) {
    try {
      const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url } },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const parsed = thumbnailSchema.safeParse(parseJsonObject(data.choices?.[0]?.message?.content || ''));
      if (parsed.success) return { findings: parsed.data, model };
    } catch {
      // try the next model
    }
  }
  return null;
}

/**
 * Picks the strongest and weakest regular videos by relative views and describes their
 * thumbnails with the vision model. Shorts are skipped: they are mostly reached by swiping,
 * not by choosing a thumbnail.
 */
export async function analyzeThumbnails(videos: VideoAnalysis[], models: string[], max: number): Promise<ThumbnailResult[]> {
  if (max <= 0 || models.length === 0) return [];
  const ranked = videos
    .filter((v) => v.format === 'video' && v.relativeViews !== null && isAllowedThumbnailUrl(v.thumbnailUrl))
    .sort((a, b) => (b.relativeViews as number) - (a.relativeViews as number));
  const perGroup = Math.floor(Math.min(max, ranked.length) / 2);
  if (perGroup < 2) return [];

  const picks = [
    ...ranked.slice(0, perGroup).map((v) => ({ video: v, group: 'top' as const })),
    ...ranked.slice(-perGroup).map((v) => ({ video: v, group: 'weak' as const })),
  ];

  return mapLimit(picks, 4, async ({ video, group }) => {
    const result = await describeThumbnail(video.thumbnailUrl as string, models);
    return { videoId: video.id, group, findings: result?.findings ?? null, model: result?.model ?? null };
  });
}

/**
 * Compares thumbnail traits between top and weak videos. These are observations, not
 * causes: a thumbnail difference can line up with performance without explaining it.
 */
export function thumbnailEvidence(results: ThumbnailResult[]): Evidence[] {
  const top = results.filter((r) => r.group === 'top' && r.findings).map((r) => r.findings!);
  const weak = results.filter((r) => r.group === 'weak' && r.findings).map((r) => r.findings!);
  if (top.length < 2 || weak.length < 2) return [];

  const confidence: Confidence = Math.min(top.length, weak.length) >= 5 ? 'medium' : 'low';
  const share = (list: ThumbnailFindings[], test: (f: ThumbnailFindings) => boolean) => list.filter(test).length;
  const evidence: Evidence[] = [];

  const traits: { id: string; label: string; test: (f: ThumbnailFindings) => boolean }[] = [
    { id: 'face', label: 'show a clear human face', test: (f) => f.faceVisible },
    { id: 'text', label: 'have text on the image', test: (f) => f.wordCount > 0 },
    { id: 'contrast', label: 'have high contrast', test: (f) => f.contrast === 'high' },
    { id: 'simple_bg', label: 'have a simple background', test: (f) => f.background === 'simple' },
    { id: 'readable', label: 'stay readable at phone size', test: (f) => f.readableAtSmallSize },
  ];
  for (const trait of traits) {
    const t = share(top, trait.test);
    const w = share(weak, trait.test);
    // Only report a clear split (at least half the group apart).
    if (Math.abs(t / top.length - w / weak.length) < 0.5) continue;
    evidence.push({
      id: `ev_thumb_${trait.id}`,
      category: 'packaging',
      statement: `${t} of your ${top.length} strongest videos and ${w} of your ${weak.length} weakest videos ${trait.label}.`,
      values: { top: t, topTotal: top.length, weak: w, weakTotal: weak.length },
      sampleSize: top.length + weak.length,
      confidence,
    });
  }

  const avgSize = (list: ThumbnailFindings[]) => list.reduce((sum, f) => sum + f.subjectSizePct, 0) / list.length;
  const topSize = avgSize(top);
  const weakSize = avgSize(weak);
  if (Math.abs(topSize - weakSize) >= 20) {
    evidence.push({
      id: 'ev_thumb_subject_size',
      category: 'packaging',
      statement: `The main subject fills about ${round(topSize, 0)}% of the image on your strongest videos and ${round(weakSize, 0)}% on your weakest.`,
      values: { topAvgPct: round(topSize, 0), weakAvgPct: round(weakSize, 0) },
      sampleSize: top.length + weak.length,
      confidence,
    });
  }
  return evidence;
}
