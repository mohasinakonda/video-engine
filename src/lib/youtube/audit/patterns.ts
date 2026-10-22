/**
 * What wins on one channel (docs/audit-plan.md §16): its own videos grouped by title traits,
 * format and length, each group's median views against the rest. Pure, and uses only the
 * videos the audit already reads, so it costs no extra quota. A group says what goes
 * together on this channel, not what causes views.
 */
import { median } from '../analysis/stats';
import { ruleFormats, titleMechanisms, type TitleMechanism } from '../discover/formats';
import { ageInDays, publicFormat } from '../discover/outliers';
import type { MarketVideo, PublicFormat } from '../discover/types';

export type TraitId =
  | 'live'
  | 'emoji'
  | 'separator'
  | 'caps'
  | 'compilation'
  | 'len_short'
  | 'len_mid'
  | 'len_long'
  | 'len_xlong'
  | `m_${TitleMechanism}`
  /** A word the channel's titles repeat (a topic or series), found per channel. */
  | `w_${string}`;

export const TRAIT_LABELS: Record<string, string> = {
  live: '“LIVE” or 🔴 in the title',
  emoji: 'Emoji in the title',
  separator: 'Title split with | or [ ]',
  caps: 'A word in ALL CAPS',
  compilation: 'A compilation',
  len_short: 'Under 5 minutes',
  len_mid: '5–15 minutes',
  len_long: '15–40 minutes',
  len_xlong: 'Over 40 minutes',
  m_comparison: '“X vs Y” in the title',
  m_number: 'A number in the title',
  m_question: 'A question as the title',
  m_how: '“How…” in the title',
  m_why: '“Why…” in the title',
  m_i_tested: '“I tested / tried…”',
  m_before_you_buy: '“Before you buy…”',
  m_strong_claim: 'A strong claim (best, most, never…)',
  m_contrarian: 'A contrarian angle (stop, wrong, truth…)',
  m_transformation: 'A transformation (before/after)',
  m_curiosity: 'A curiosity gap (secret, nobody knows…)',
  m_problem: 'A problem (mistake, fix, avoid…)',
};

/** "Title split…" → "title split…" inside a sentence; "LIVE" and quotes stay as written. */
export const lowerFirst = (label: string) => (/^[A-Z](?![A-Z])/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label);

/** Groups smaller than this say nothing; a group is only compared when both sides have it. */
export const MIN_GROUP = 4;
/** How far apart two groups must be (either way) to be shown as a pattern. */
export const MIN_LIFT = 1.5;

const EMOJI = new RegExp('\\p{Extended_Pictographic}', 'u');
const CAPS = /\b[A-Z]{4,}\b/;
const NOT_SHOUTING = /^(NASA|HTML|JSON|ASMR|IPHONE|LIVE|ABCD?|DIY|FAQ|USA|NBA|NFL|FIFA|WWE|GTA|ASAP)$/;

/** The traits of one video. Length groups only apply to long-form videos. */
export function traitsOf(v: { title: string; durationSec: number | null }): TraitId[] {
  const t = v.title;
  const out: TraitId[] = [];
  if (/\blive\b/i.test(t) || t.includes('🔴')) out.push('live');
  if (EMOJI.test(t.replace('🔴', ''))) out.push('emoji');
  if (/[|｜]|\[[^\]]+\]/.test(t)) out.push('separator');
  if ((t.match(new RegExp(CAPS.source, 'g')) ?? []).some((w) => !NOT_SHOUTING.test(w))) out.push('caps');
  if (ruleFormats(t).primary === 'compilation' || ((v.durationSec ?? 0) >= 20 * 60 && /\b(songs?|rhymes?|episodes?|mix|collection|non[-\s]?stop|more)\b/i.test(t))) out.push('compilation');
  for (const m of titleMechanisms(t)) out.push(`m_${m}`);
  if (publicFormat(v.durationSec) === 'video' && v.durationSec) {
    const min = v.durationSec / 60;
    out.push(min < 5 ? 'len_short' : min < 15 ? 'len_mid' : min < 40 ? 'len_long' : 'len_xlong');
  }
  return out;
}

export interface ChannelPattern {
  /** Traits that always come together on this channel are one group. */
  traits: TraitId[];
  label: string;
  withCount: number;
  withMedian: number;
  withoutCount: number;
  withoutMedian: number;
  /** withMedian / withoutMedian. */
  lift: number;
  /** Whether the audited video has every trait of the group. */
  thisHas: boolean;
}

export interface ChartPoint {
  id: string;
  title: string;
  durationSec: number;
  views: number;
  ageDays: number;
  isThis: boolean;
}

export interface ChannelPatterns {
  format: PublicFormat;
  /** Same-format videos aged 7–365 days that the groups are built from. */
  sample: number;
  /** Clear differences, strongest first. */
  patterns: ChannelPattern[];
  /** This video's own choices that make little difference on this channel (also worth knowing). */
  neutral: ChannelPattern[];
  chart: ChartPoint[];
}

const STOPWORDS = new Set(
  'the and for with you your this that what when where from are was were have has how why who its it’s let’s lets into about more most some than then them they will can just like make made over very our out all new one two get got video videos part full official episode live compilation shorts short'.split(' ')
);
const WORD = new RegExp('[\\p{L}\\p{M}][\\p{L}\\p{M}\\p{N}’\'-]*', 'gu');
/** Words that make a repeated topic: in at least MIN_GROUP titles, but not in nearly all of them. */
const MAX_WORD_SHARE = 0.6;
const MAX_WORDS = 15;

const wordsOf = (title: string) => new Set((title.toLowerCase().match(WORD) ?? []).filter((w) => w.length >= 4 && !STOPWORDS.has(w)));
const wordLabel = (w: string) => `“${w.charAt(0).toUpperCase()}${w.slice(1)}” in the title`;

const MIN_AGE = 7;
const MAX_AGE = 365;

/**
 * Patterns among the channel's same-format videos. The audited video is left out of the groups
 * (it is what's being explained) but shown on the chart. Strongest difference first.
 */
export function channelPatterns(target: MarketVideo, others: MarketVideo[], now: Date): ChannelPatterns | null {
  const format = publicFormat(target.durationSec);
  if (!format) return null;
  const pool = others.filter((v) => {
    if (v.id === target.id || v.views === null || publicFormat(v.durationSec) !== format) return false;
    const age = ageInDays(v.publishedAt, now);
    return age >= MIN_AGE && age <= MAX_AGE;
  });

  // The channel's repeated topic words, most common first (few, to keep chance findings rare).
  const counts = new Map<string, number>();
  pool.forEach((v) => wordsOf(v.title).forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1)));
  const topicWords = Array.from(counts.entries())
    .filter(([, n]) => n >= MIN_GROUP && n <= pool.length * MAX_WORD_SHARE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_WORDS)
    .map(([w]) => w);
  const traitsWithWords = (v: { title: string; durationSec: number | null }): TraitId[] => {
    const words = wordsOf(v.title);
    return [...traitsOf(v), ...topicWords.filter((w) => words.has(w)).map((w) => `w_${w}` as TraitId)];
  };

  const tagged = pool.map((v) => ({ v, traits: new Set(traitsWithWords(v)) }));
  const own = new Set(traitsWithWords(target));
  const all = new Set(tagged.flatMap((x) => Array.from(x.traits)));
  const labelOf = (t: TraitId) => (t.startsWith('w_') ? wordLabel(t.slice(2)) : TRAIT_LABELS[t] ?? t);

  // Traits that mark exactly the same videos are one group ("LIVE + emoji + compilation").
  const groups = new Map<string, TraitId[]>();
  for (const trait of Array.from(all)) {
    const key = tagged.map((x) => (x.traits.has(trait) ? '1' : '0')).join('');
    groups.set(key, [...(groups.get(key) ?? []), trait]);
  }

  const patterns: ChannelPattern[] = [];
  const neutral: ChannelPattern[] = [];
  for (const [key, traits] of Array.from(groups.entries())) {
    // "Has X" and "lacks Y" for the same split say one thing: keep the side with more views.
    const complement = Array.from(key, (c) => (c === '1' ? '0' : '1')).join('');
    const withViews = tagged.filter((_, i) => key[i] === '1').map((x) => x.v.views as number);
    const withoutViews = tagged.filter((_, i) => key[i] === '0').map((x) => x.v.views as number);
    if (withViews.length < MIN_GROUP || withoutViews.length < MIN_GROUP) continue;
    const withMedian = median(withViews) ?? 0;
    const withoutMedian = median(withoutViews) ?? 0;
    if (withMedian <= 0 || withoutMedian <= 0) continue;
    const lift = withMedian / withoutMedian;
    const label = traits.map((t, i) => (i === 0 ? labelOf(t) : lowerFirst(labelOf(t)))).join(', ');
    const pattern = { traits, label, withCount: withViews.length, withMedian, withoutCount: withoutViews.length, withoutMedian, lift, thisHas: traits.every((t) => own.has(t)) };
    if (lift < MIN_LIFT && lift > 1 / MIN_LIFT) {
      if (pattern.thisHas) neutral.push(pattern);
      continue;
    }
    if (lift < 1 && groups.has(complement)) continue;
    patterns.push(pattern);
  }
  patterns.sort((a, b) => Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift)));
  neutral.sort((a, b) => b.withCount - a.withCount);

  const chart: ChartPoint[] = [...pool, target]
    .filter((v) => v.durationSec && v.views !== null)
    .map((v) => ({ id: v.id, title: v.title, durationSec: v.durationSec as number, views: v.views as number, ageDays: Math.floor(ageInDays(v.publishedAt, now)), isThis: v.id === target.id }));

  return { format, sample: pool.length, patterns: patterns.slice(0, 8), neutral: neutral.slice(0, 5), chart };
}

/** The parts of a description that show how the channel uses it. */
export interface DescriptionParts {
  lyrics: boolean;
  playlists: number;
  videoLinks: number;
  socialLinks: number;
  otherLinks: number;
  sponsor: boolean;
  chapters: number;
  hashtags: number;
}

const URL = /https?:\/\/\S+/gi;

export function descriptionParts(description: string, chapters: number, hashtags: number): DescriptionParts {
  const urls = description.match(URL) ?? [];
  const isPlaylist = (u: string) => /youtube\.com\/playlist\?|[?&]list=/i.test(u);
  const isVideo = (u: string) => !isPlaylist(u) && /youtube\.com\/(watch|shorts)|youtu\.be\//i.test(u);
  const isSocial = (u: string) => /instagram\.com|tiktok\.com|facebook\.com|fb\.com|twitter\.com|x\.com\/|threads\.net|discord\.gg|patreon\.com|linkedin\.com/i.test(u);
  return {
    lyrics: /\blyrics\b|লিরিক|গানের কথা/i.test(description),
    playlists: urls.filter(isPlaylist).length,
    videoLinks: urls.filter(isVideo).length,
    socialLinks: urls.filter(isSocial).length,
    otherLinks: urls.filter((u) => !isPlaylist(u) && !isVideo(u) && !isSocial(u)).length,
    sponsor: /\bsponsor(ed)?\b|\bpromo code\b|\buse code\b|\baffiliate\b|amzn\.to|% off\b|\bdiscount\b/i.test(description),
    chapters,
    hashtags,
  };
}

const norm = (t: string) => t.trim().toLowerCase();

/** Tags on at least half of these lists. */
function commonTags(lists: string[][]): string[] {
  const counts = new Map<string, number>();
  lists.forEach((list) => new Set(list.map(norm)).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return Array.from(counts.entries())
    .filter(([, n]) => n >= Math.max(2, Math.ceil(lists.length / 2)))
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

/**
 * Tags that set the channel's best videos apart: on most of them but not on most of the rest
 * (a channel's boilerplate tags say nothing). Which of those this video has, and which it lacks.
 */
export function tagOverlap(tags: string[], bestTags: string[][], restTags: string[][]): { shared: string[]; missing: string[]; boilerplate: string[] } {
  if (bestTags.length < 2) return { shared: [], missing: [], boilerplate: [] };
  const boilerplate = new Set(restTags.length >= 2 ? commonTags(restTags) : []);
  const distinct = commonTags(bestTags).filter((t) => !boilerplate.has(t));
  const own = new Set(tags.map(norm));
  return {
    shared: distinct.filter((t) => own.has(t)).slice(0, 12),
    missing: distinct.filter((t) => !own.has(t)).slice(0, 12),
    boilerplate: Array.from(boilerplate).filter((t) => own.has(t)).slice(0, 30),
  };
}
