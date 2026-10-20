/**
 * Video audit, deterministic part (docs/audit-plan.md §2). Pure: public data in, findings out.
 * Every finding carries its evidence and a confidence; nothing is guessed. The AI parts
 * (thumbnail, comments, lessons) are added on top in A2.
 */
import { median } from '../analysis/stats';
import { BANNED } from '../discover/ai/interpret';
import { MECHANISM_LABELS, titleMechanisms, type TitleMechanism } from '../discover/formats';
import { ageInDays, judgeVideo, publicBaselines, publicFormat } from '../discover/outliers';
import type { MarketVideo, PublicFormat } from '../discover/types';
import type { Confidence } from '../types';
import type { AuditVideo } from './fetch';

export type FindingArea = 'performance' | 'title' | 'thumbnail' | 'metadata' | 'format' | 'viewers' | 'pattern' | 'rhythm' | 'comparison';
export type FindingKind = 'strength' | 'weakness' | 'note';

export interface AuditFinding {
  id: string;
  area: FindingArea;
  kind: FindingKind;
  statement: string;
  evidence: string | null;
  confidence: Confidence;
}

export type PerformanceLabel = 'standout' | 'above' | 'typical' | 'below' | 'well_below' | 'not_comparable';

export interface VideoAuditResult {
  format: PublicFormat | null;
  ageDays: number;
  performance: {
    label: PerformanceLabel;
    ratio: number | null;
    baselineViews: number | null;
    baselineSample: number;
    likeRate: number | null;
    baselineLikeRate: number | null;
    commentRate: number | null;
    baselineCommentRate: number | null;
  };
  findings: AuditFinding[];
  limitations: string[];
}

/** Past this, titles are cut off in search, suggestions and on phones. */
export const TITLE_VISIBLE = 70;
/** Engagement rates need this many views to mean something. */
const MIN_VIEWS_FOR_RATES = 500;
/** Same-format videos needed to compare engagement. */
const MIN_RATE_SAMPLE = 5;
/** YouTube ignores every hashtag on a video that has more than this many. */
export const HASHTAG_LIMIT = 60;

const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;
const times = (x: number) => `${x >= 10 ? Math.round(x) : x.toFixed(1)}×`;
const fmt = (n: number) => n.toLocaleString('en-US');
const formatName = (f: PublicFormat) => (f === 'short' ? 'Shorts' : 'long-form videos');

const asMarket = (v: AuditVideo): MarketVideo => ({
  id: v.id,
  channelId: v.channelId,
  title: v.title,
  publishedAt: v.publishedAt,
  durationSec: v.durationSec,
  views: v.views,
  likes: v.likes,
  comments: v.comments,
  thumbnailUrl: v.thumbnailUrl,
});

/** Chapter lines ("0:00 Intro"); YouTube needs at least 3, starting at 0:00. */
export function chaptersOf(description: string): string[] {
  const lines = description.split('\n').map((l) => l.trim());
  return lines.filter((l) => /^\(?(\d{1,2}:)?\d{1,2}:\d{2}\)?\s*[-–:|]?\s*\S/.test(l));
}

export const hasValidChapters = (description: string) => {
  const chapters = chaptersOf(description);
  return chapters.length >= 3 && /^\(?0?0:00/.test(chapters[0]);
};

/** Hashtags in any script (Bangla vowel signs are marks). */
const HASHTAG = new RegExp('(^|\\s)#[\\p{L}\\p{M}\\p{N}_]+', 'gu');
export const hashtagsIn = (text: string) => text.match(HASHTAG)?.length ?? 0;

/** The part of the description shown before "more". */
export const visibleDescription = (description: string) => description.trim().split('\n').slice(0, 2).join(' ').slice(0, 150);

/** Weaknesses first, then strengths, then notes; higher confidence first within each. In place. */
export function sortFindings(findings: AuditFinding[]): AuditFinding[] {
  const order: Record<FindingKind, number> = { weakness: 0, strength: 1, note: 2 };
  const conf: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => order[a.kind] - order[b.kind] || conf[a.confidence] - conf[b.confidence]);
}

const rate = (part: number | null, views: number | null) => (part === null || views === null || views <= 0 ? null : part / views);

export function auditVideo(video: AuditVideo, channelVideos: MarketVideo[], now: Date): VideoAuditResult {
  const findings: AuditFinding[] = [];
  const limitations: string[] = [];
  const add = (area: FindingArea, kind: FindingKind, statement: string, evidence: string | null, confidence: Confidence) =>
    findings.push({ id: `${area}_${findings.length + 1}`, area, kind, statement, evidence, confidence });

  const format = publicFormat(video.durationSec);
  const age = ageInDays(video.publishedAt, now);
  // The usual comes from the channel's other videos.
  const others = channelVideos.filter((v) => v.id !== video.id);
  const baselines = publicBaselines(others, now);
  const judged = judgeVideo(asMarket(video), baselines, now);
  const baseline = format ? baselines[format] : null;

  // ─── Performance against its own channel ──────────────────────────────────
  let label: PerformanceLabel = 'not_comparable';
  if (video.views === null) limitations.push('This video hides its view count, so its performance can’t be compared.');
  else if (age < 7) limitations.push('The video is less than a week old and still collecting views, so it isn’t compared yet.');
  else if (!judged.eligible) {
    limitations.push(`The channel has too few ${format ? formatName(format) : 'videos'} from the past year to know its usual (${baseline?.sampleSize ?? 0} found).`);
  } else if (judged.ratio !== null && baseline?.medianViews) {
    const r = judged.ratio;
    const evidence = `${fmt(video.views)} views vs a median of ${fmt(baseline.medianViews)} across ${baseline.sampleSize} of the channel’s ${formatName(format!)} aged 7–365 days.`;
    const conf = judged.confidence ?? 'medium';
    if (judged.isOutlier) {
      label = 'standout';
      add('performance', 'strength', `A standout: ${times(r)} the channel’s usual views.`, evidence, conf);
    } else if (r >= 1.25) {
      label = 'above';
      add('performance', 'strength', `Above the channel’s usual: ${times(r)} its typical views.`, evidence, conf);
    } else if (r >= 0.8) {
      label = 'typical';
      add('performance', 'note', 'About as many views as the channel’s usual video.', evidence, conf);
    } else if (r >= 0.5) {
      label = 'below';
      add('performance', 'weakness', `Below the channel’s usual: ${times(r)} its typical views.`, evidence, conf);
    } else {
      label = 'well_below';
      add('performance', 'weakness', `Well below the channel’s usual: ${times(r)} its typical views.`, evidence, conf);
    }
  }

  // Engagement, against the same format on the same channel.
  const peers = others.filter((v) => publicFormat(v.durationSec) === format && (v.views ?? 0) >= 100);
  const likeRates = peers.map((v) => rate(v.likes, v.views)).filter((x): x is number => x !== null);
  const commentRates = peers.map((v) => rate(v.comments, v.views)).filter((x): x is number => x !== null);
  const likeRate = rate(video.likes, video.views);
  const commentRate = rate(video.comments, video.views);
  const baselineLikeRate = likeRates.length >= MIN_RATE_SAMPLE ? median(likeRates) : null;
  const baselineCommentRate = commentRates.length >= MIN_RATE_SAMPLE ? median(commentRates) : null;
  if ((video.views ?? 0) >= MIN_VIEWS_FOR_RATES) {
    if (likeRate !== null && baselineLikeRate) {
      const r = likeRate / baselineLikeRate;
      const evidence = `${pct(likeRate)} of viewers liked it vs ${pct(baselineLikeRate)} on the channel’s usual video (${likeRates.length} compared).`;
      if (r >= 1.5) add('performance', 'strength', 'Viewers liked it more than usual for this channel.', evidence, 'medium');
      else if (r <= 0.6) add('performance', 'weakness', 'Fewer viewers liked it than usual for this channel.', evidence, 'medium');
    }
    if (commentRate !== null && baselineCommentRate) {
      const r = commentRate / baselineCommentRate;
      const evidence = `${pct(commentRate)} of viewers commented vs ${pct(baselineCommentRate)} usually (${commentRates.length} compared).`;
      if (r >= 1.5) add('viewers', 'strength', 'It started more conversation than the channel’s usual video.', evidence, 'medium');
      else if (r <= 0.5) add('viewers', 'note', 'Fewer viewers commented than usual for this channel.', evidence, 'low');
    }
  }

  // ─── Title ────────────────────────────────────────────────────────────────
  const title = video.title;
  const mechanisms = titleMechanisms(title);
  if (title.length > TITLE_VISIBLE) {
    add('title', 'weakness', `The title is ${title.length} characters; past about ${TITLE_VISIBLE} it gets cut off in search, suggestions and on phones.`, `Visible part: “${title.slice(0, TITLE_VISIBLE)}…”`, 'medium');
  }
  if (mechanisms.length) {
    add('title', 'note', `The title uses ${mechanisms.map((m) => MECHANISM_LABELS[m].toLowerCase()).join(', ')}.`, null, 'high');
  }
  const shouting = (title.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => !/^(NASA|HTML|JSON|ASMR|IPHONE)$/.test(w));
  if (shouting.length >= 2) add('title', 'weakness', 'Several all-caps words can read as shouting or clickbait.', shouting.slice(0, 4).join(', '), 'low');
  if (BANNED.test(title)) add('title', 'weakness', 'Hype words in the title can read as clickbait and raise expectations the video has to meet.', null, 'low');

  // What the channel's own standouts do with their titles.
  const standouts = others.filter((v) => judgeVideo(v, baselines, now).isOutlier);
  if (standouts.length >= 3) {
    const counts = new Map<TitleMechanism, number>();
    standouts.forEach((v) => titleMechanisms(v.title).forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1)));
    const [top] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (top && top[1] / standouts.length >= 0.5) {
      const uses = mechanisms.includes(top[0]);
      const statement = uses
        ? `Like most of the channel’s standouts, it uses ${MECHANISM_LABELS[top[0]].toLowerCase()}.`
        : `Most of the channel’s standouts use ${MECHANISM_LABELS[top[0]].toLowerCase()}; this title doesn’t.`;
      add('title', uses ? 'strength' : label === 'below' || label === 'well_below' ? 'weakness' : 'note', statement, `${top[1]} of the channel’s ${standouts.length} standout videos.`, standouts.length >= 5 ? 'medium' : 'low');
    }
  }

  // ─── Description and metadata ─────────────────────────────────────────────
  const description = video.description.trim();
  const visible = visibleDescription(description);
  if (!description) add('metadata', 'weakness', 'There is no description: nothing tells viewers or search what the video covers.', null, 'high');
  else if (/^(https?:\/\/|www\.|#)/i.test(visible)) {
    add('metadata', 'weakness', 'The first lines under the video (the part shown before “more”) are a link or hashtags, not what the video is about.', `“${visible.slice(0, 80)}…”`, 'medium');
  }
  if (format === 'video' && (video.durationSec ?? 0) >= 480) {
    if (hasValidChapters(description)) add('metadata', 'strength', 'It has chapters, which help viewers jump to what they want and show up in search.', `${chaptersOf(description).length} chapters.`, 'high');
    else add('metadata', 'note', 'No chapters on a video this long; chapters help viewers find their part instead of leaving.', null, 'low');
  }
  const hashtags = hashtagsIn(`${title} ${description}`);
  if (hashtags > HASHTAG_LIMIT) add('metadata', 'weakness', `It has ${hashtags} hashtags; YouTube ignores all of them above ${HASHTAG_LIMIT}.`, null, 'high');

  // ─── Format and length ────────────────────────────────────────────────────
  if (format && video.durationSec) {
    const durations = others.filter((v) => publicFormat(v.durationSec) === format && v.durationSec).map((v) => v.durationSec as number);
    const usual = durations.length >= MIN_RATE_SAMPLE ? median(durations) : null;
    if (usual && (video.durationSec >= usual * 1.6 || video.durationSec <= usual * 0.5)) {
      const longer = video.durationSec > usual;
      add('format', label === 'below' || label === 'well_below' ? 'weakness' : 'note', `Much ${longer ? 'longer' : 'shorter'} than the channel’s usual ${formatName(format).replace(/s$/, '')}.`, `${Math.round(video.durationSec / 60)} min vs a usual ${Math.round(usual / 60)} min.`, 'low');
    }
  }

  limitations.push('YouTube doesn’t share another channel’s click rate, retention or traffic sources, so those parts are judged from public signals only.');

  sortFindings(findings);

  return {
    format,
    ageDays: Math.floor(age),
    performance: {
      label,
      ratio: judged.ratio === null ? null : Math.round(judged.ratio * 100) / 100,
      baselineViews: baseline?.medianViews ?? null,
      baselineSample: baseline?.sampleSize ?? 0,
      likeRate,
      baselineLikeRate,
      commentRate,
      baselineCommentRate,
    },
    findings,
    limitations,
  };
}
