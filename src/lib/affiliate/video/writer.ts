/**
 * The AI part of the video pack: one product-review script for the selected products (written
 * from their Amazon feature bullets only), checked without AI and rewritten once if it breaks a
 * rule; and the SEO pack for the upload.
 */
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { titleProblems } from '../../youtube/next-shorts/validate';
import { scriptIssues, videoTagFor } from './checks';
import {
  CLIP_SECONDS,
  ON_SCREEN_MAX_WORDS,
  VO_MAX_WORDS,
  VO_MIN_WORDS,
  seoSchema,
  videoScriptSchema,
  type ProductFacts,
  type SeoPack,
  type VideoPack,
  type VideoRequest,
  type VideoScript,
} from './types';

const TIMEOUT_MS = 60_000;

const SCRIPT_SYSTEM = `You write a fast product-review YouTube Short for Google Flow: one ${CLIP_SECONDS}-second clip per product, in the order given.
- English. Each clip's "voiceover" is ${VO_MIN_WORDS}–${VO_MAX_WORDS} words (read at about 200 words a minute): the product's name once, what it does, and one concrete feature from its bullets. Clip 1's voiceover starts with the "hook" (a short line that makes viewers stay, e.g. "Five car gadgets that are actually worth it.").
- Only claim what the product's bullets say. No prices, discounts, "#1", "best ever", guarantees or results you can't see.
- "productName": a short spoken name (2–4 words, no brand claims), like "Mini Car Vacuum".
- "startImage": how to edit the creator's photo of the product into the clip's first frame: the product in a real setting, in use or in hand, vertical 9:16. Never change the product itself.
- Each clip: ONE subject, ONE action already happening at the first frame (no "then", no lists), ONE camera position, at most one camera move ("none", "push_in", "pull_back", "pan", "orbit", "tilt"). Lock the camera ("none") when hands use the product.
- "onScreenText": up to ${ON_SCREEN_MAX_WORDS} words for editing (the product's name or its one benefit).
- "look": one shared look for every clip (setting style, light, color). "voice": the narrator.
Reply only with JSON:
{"hook": "...", "look": "...", "voice": "energetic, friendly American narrator",
 "clips": [{"asin": "<the product's asin>", "productName": "...", "startImage": "...", "subject": "...", "action": "...",
   "camera": {"position": "...", "movement": "none"}, "setting": "...", "lighting": "...", "voiceover": "...", "onScreenText": "..."}]}`;

export async function writeVideoPack(req: VideoRequest, products: ProductFacts[], models: string[]): Promise<VideoPack | null> {
  const base = {
    niche: req.label,
    creatorNotes: req.notes || null,
    products: products.map((p) => ({ asin: p.asin, title: p.title, brand: p.brand, bullets: p.bullets.slice(0, 6) })),
  };
  const ask = async (extra: object | null): Promise<VideoScript | null> => {
    const answer = await callLLM({
      messages: [
        { role: 'system', content: SCRIPT_SYSTEM },
        { role: 'user', content: JSON.stringify(extra ? { ...base, ...extra } : base) },
      ],
      json: true,
      temperature: 0.6,
      maxTokens: 3500,
      timeoutMs: TIMEOUT_MS,
      models,
      tag: 'affiliate/video',
      accept: (c) => videoScriptSchema.safeParse(parseJsonObject(c)).success,
    });
    return answer ? videoScriptSchema.parse(parseJsonObject(answer.content)) : null;
  };

  let script = await ask(null);
  if (!script) return null;
  let issues = scriptIssues(script, products);
  if (issues.length) {
    const second = await ask({ yourLastScript: script, fixTheseProblems: issues });
    const secondIssues = second ? scriptIssues(second, products) : null;
    if (second && secondIssues && secondIssues.length <= issues.length) {
      script = second;
      issues = secondIssues;
    }
  }
  // Keep only clips for the selected products, in their order.
  const byAsin = new Map(script.clips.map((c) => [c.asin, c]));
  const clips = products.map((p) => byAsin.get(p.asin)).filter((c): c is VideoScript['clips'][number] => Boolean(c));
  if (clips.length === 0) return null;

  return {
    version: 1,
    model: req.model,
    domain: req.domain,
    label: req.label,
    videoTag: videoTagFor(req.label),
    products,
    script: { ...script, clips },
    issues,
    createdAt: new Date().toISOString(),
  };
}

const SEO_SYSTEM = `You write the YouTube upload packaging for a product-review Short.
- "titles": 4 options with different angles (the list, the problem it solves, curiosity, the niche). At most 60 characters, the key words first. No hashtags, emojis, prices, "#1", "best ever" or times.
- "thumbnail": a concept, an image prompt (the products together, vertical, bright, clean background, no added text), and up to 4 words of text to put on it.
- "description": line 1 is a plain hook with the main keyword; then a numbered list of the products by their short names; then the line "Links: {BIO_LINK}" exactly; then "As an Amazon Associate I earn from qualifying purchases." No prices.
- "keywords": up to 20 YouTube tags people search for, most specific first.
- "hashtags": 3, specific (no #shorts).
English. Reply only with JSON: {"titles": [{"title": "...", "angle": "..."}], "thumbnail": {"concept": "...", "imagePrompt": "...", "text": "..."}, "description": "...", "keywords": ["..."], "hashtags": ["#..."]}`;

export interface SeoInput {
  label: string;
  hook: string;
  productNames: string[];
  productTitles: string[];
}

export async function writeSeo(input: SeoInput, bioLink: string | null, models: string[]): Promise<SeoPack | null> {
  const answer = await callLLM({
    messages: [
      { role: 'system', content: SEO_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({ niche: input.label, hook: input.hook, products: input.productNames, productTitles: input.productTitles }),
      },
    ],
    json: true,
    temperature: 0.7,
    maxTokens: 2000,
    timeoutMs: 45_000,
    models,
    tag: 'affiliate/seo',
    accept: (c) => seoSchema.safeParse(parseJsonObject(c)).success,
  });
  if (!answer) return null;
  const seo = seoSchema.parse(parseJsonObject(answer.content));
  const titles = seo.titles.map((t) => ({ ...t, title: t.title.replace(/\s*#\S+/g, '').trim() })).filter((t) => titleProblems(t.title).length === 0);
  const link = bioLink ?? 'link in my bio';
  let description = seo.description.replace(/\{BIO_LINK\}/g, link);
  if (!description.includes(link)) description += `\n\nLinks: ${link}`;
  if (!/amazon associate/i.test(description)) description += '\nAs an Amazon Associate I earn from qualifying purchases.';
  const hashtags = Array.from(new Set(seo.hashtags.map((h) => `#${h.replace(/^#+/, '').replace(/\s+/g, '')}`)))
    .filter((h) => h.toLowerCase() !== '#shorts')
    .slice(0, 3);
  // YouTube's tag box holds 500 characters.
  const keywords: string[] = [];
  for (const k of seo.keywords) if ([...keywords, k].join(',').length <= 500) keywords.push(k);
  return { ...seo, titles: titles.length ? titles : seo.titles.slice(0, 1), description, hashtags, keywords, bioLink, createdAt: new Date().toISOString() };
}
