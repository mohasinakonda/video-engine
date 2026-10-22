/**
 * Video audit, deterministic part (docs/audit-plan.md §2). Pure: public data in, findings out.
 * Every finding carries its evidence and a confidence; nothing is guessed. The AI parts
 * (thumbnail, comments, lessons) are added on top in A2.
 */
import { median } from '../analysis/stats';
import { BANNED } from '../discover/ai/interpret';
import { MECHANISM_LABELS, titleMechanisms } from '../discover/formats';
import { ageInDays, judgeVideo, publicBaselines, publicFormat } from '../discover/outliers';
import type { MarketVideo, PublicFormat } from '../discover/types';
import type { Confidence } from '../types';
import type { AuditVideo } from './fetch';
import { channelPatterns, descriptionParts, lowerFirst, tagOverlap, traitsOf, type ChannelPatterns, type DescriptionParts } from './patterns';

export type FindingArea = 'performance' | 'title' | 'thumbnail' | 'metadata' | 'format' | 'viewers' | 'pattern' | 'rhythm' | 'comparison' | 'audience';
export type FindingKind = 'strength' | 'weakness' | 'note';
/** How much a finding explains the result: low is polish (title length, chapters…). */
export type FindingImpact = 'high' | 'medium' | 'low';

export interface AuditFinding {
  id: string;
  area: FindingArea;
  kind: FindingKind;
  statement: string;
  evidence: string | null;
  confidence: Confidence;
  /** Missing means medium. */
  impact?: FindingImpact;
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
  /** What wins on the video's own channel; null without a format. */
  patterns: ChannelPatterns | null;
  description: DescriptionParts;
  /** shared/missing: tags that set its best videos apart; boilerplate: on most of its videos. */
  tags: { all: string[]; shared: string[]; missing: string[]; boilerplate: string[]; from: 'standouts' | 'top' | null };
  madeForKids: boolean | null;
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

/** Weaknesses first, then strengths, then notes; bigger impact, then higher confidence, first within each. In place. */
export function sortFindings(findings: AuditFinding[]): AuditFinding[] {
  const order: Record<FindingKind, number> = { weakness: 0, strength: 1, note: 2 };
  const level: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  const impact = (f: AuditFinding) => level[f.impact ?? 'medium'];
  return findings.sort((a, b) => order[a.kind] - order[b.kind] || impact(a) - impact(b) || level[a.confidence] - level[b.confidence]);
}

const fmtViews = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

const rate = (part: number | null, views: number | null) => (part === null || views === null || views <= 0 ? null : part / views);

export function auditVideo(video: AuditVideo, channelVideos: (MarketVideo & { tags?: string[] })[], now: Date): VideoAuditResult {
  const findings: AuditFinding[] = [];
  const limitations: string[] = [];
  const add = (area: FindingArea, kind: FindingKind, statement: string, evidence: string | null, confidence: Confidence, impact: FindingImpact = 'medium') =>
    findings.push({ id: `${area}_${findings.length + 1}`, area, kind, statement, evidence, confidence, impact });

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
      add('performance', 'strength', `A standout: ${times(r)} the channel’s usual views.`, evidence, conf, 'high');
    } else if (r >= 1.25) {
      label = 'above';
      add('performance', 'strength', `Above the channel’s usual: ${times(r)} its typical views.`, evidence, conf, 'high');
    } else if (r >= 0.8) {
      label = 'typical';
      add('performance', 'note', 'About as many views as the channel’s usual video.', evidence, conf);
    } else if (r >= 0.5) {
      label = 'below';
      add('performance', 'weakness', `Below the channel’s usual: ${times(r)} its typical views.`, evidence, conf, 'high');
    } else {
      label = 'well_below';
      add('performance', 'weakness', `Well below the channel’s usual: ${times(r)} its typical views.`, evidence, conf, 'high');
    }
  }

  // Lifetime views favour older videos: say so when this one is much older than its comparison.
  if (label !== 'not_comparable' && format && video.views !== null) {
    const compared = others.filter((v) => publicFormat(v.durationSec) === format && v.views !== null).filter((v) => {
      const a = ageInDays(v.publishedAt, now);
      return a >= 7 && a <= 365;
    });
    const ages = compared.map((v) => ageInDays(v.publishedAt, now));
    const usualAge = median(ages);
    const usualPerDay = median(compared.map((v) => (v.views as number) / ageInDays(v.publishedAt, now)));
    if (usualAge && usualPerDay && age > usualAge * 1.5) {
      const perDay = video.views / age;
      add(
        'performance',
        'note',
        `It’s older than most videos it’s compared with (${Math.floor(age)} days vs a median of ${Math.floor(usualAge)}), so part of the gap is time.`,
        `Per day since upload: ${fmtViews(perDay)} views vs ${fmtViews(usualPerDay)} for the channel’s usual video (${times(perDay / usualPerDay)}).`,
        'high',
        'high'
      );
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
    add('title', 'weakness', `The title is ${title.length} characters; past about ${TITLE_VISIBLE} it gets cut off in search, suggestions and on phones.`, `Visible part: “${title.slice(0, TITLE_VISIBLE)}…”`, 'medium', 'low');
  }
  if (mechanisms.length) {
    add('title', 'note', `The title uses ${mechanisms.map((m) => MECHANISM_LABELS[m].toLowerCase()).join(', ')}.`, null, 'high', 'low');
  }
  const shouting = (title.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => !/^(NASA|HTML|JSON|ASMR|IPHONE)$/.test(w));
  if (shouting.length >= 2) add('title', 'weakness', 'Several all-caps words can read as shouting or clickbait.', shouting.slice(0, 4).join(', '), 'low', 'low');
  if (BANNED.test(title)) add('title', 'weakness', 'Hype words in the title can read as clickbait and raise expectations the video has to meet.', null, 'low', 'low');

  // ─── What wins on this channel ─────────────────────────────────────────────
  const weak = label === 'below' || label === 'well_below';
  const patterns = channelPatterns(asMarket(video), others, now);
  for (const pat of (patterns?.patterns ?? []).slice(0, 4)) {
    const evidence = `Median ${fmtViews(pat.withMedian)} views for ${pat.withCount} videos with it vs ${fmtViews(pat.withoutMedian)} for ${pat.withoutCount} without (past year, same format).`;
    const conf: Confidence = pat.withCount >= 5 && pat.withoutCount >= 5 ? 'medium' : 'low';
    const impact: FindingImpact = pat.lift >= 2 || pat.lift <= 0.5 ? 'high' : 'medium';
    const what = lowerFirst(pat.label);
    // A topic the video isn't about isn't something it "skipped"; those stay in the patterns panel.
    const topicOnly = pat.traits.every((t) => t.startsWith('w_'));
    if (pat.lift > 1 && pat.thisHas) add('pattern', 'strength', `Follows what works on this channel: ${what}.`, evidence, conf, impact);
    else if (pat.lift > 1 && !topicOnly) add('pattern', weak ? 'weakness' : 'note', `Skips what works on this channel: ${what}.`, evidence, conf, impact);
    else if (pat.thisHas) add('pattern', weak ? 'weakness' : 'note', `Has something that usually goes with fewer views here: ${what}.`, evidence, conf, impact);
  }

  // ─── Audience and labels ──────────────────────────────────────────────────
  if (video.madeForKids) {
    add('audience', 'note', 'Set as made for kids: YouTube turns off comments, the notification bell, cards and end screens on it.', 'Without the bell, new uploads reach viewers mostly through the home feed, suggestions and autoplay.', 'high', 'high');
  }
  if (traitsOf(video).includes('live') && !video.wasStreamed && !video.liveOrUpcoming) {
    const live = patterns?.patterns.find((x) => x.traits.includes('live'));
    add('title', 'note', 'The title says LIVE, but it was uploaded as a regular video, not streamed.', live ? `On this channel, titles with LIVE get a median of ${fmtViews(live.withMedian)} views vs ${fmtViews(live.withoutMedian)} without.` : null, 'high', live ? 'medium' : 'low');
  }

  // ─── Description and metadata ─────────────────────────────────────────────
  const description = video.description.trim();
  const visible = visibleDescription(description);
  if (!description) add('metadata', 'weakness', 'There is no description: nothing tells viewers or search what the video covers.', null, 'high');
  else if (/^(https?:\/\/|www\.|#)/i.test(visible)) {
    add('metadata', 'weakness', 'The first lines under the video (the part shown before “more”) are a link or hashtags, not what the video is about.', `“${visible.slice(0, 80)}…”`, 'medium', 'low');
  }
  if (format === 'video' && (video.durationSec ?? 0) >= 480) {
    if (hasValidChapters(description)) add('metadata', 'strength', 'It has chapters, which help viewers jump to what they want and show up in search.', `${chaptersOf(description).length} chapters.`, 'high', 'low');
    else add('metadata', 'note', 'No chapters on a video this long; chapters help viewers find their part instead of leaving.', null, 'low', 'low');
  }
  const hashtags = hashtagsIn(`${title} ${description}`);
  if (hashtags > HASHTAG_LIMIT) add('metadata', 'weakness', `It has ${hashtags} hashtags; YouTube ignores all of them above ${HASHTAG_LIMIT}.`, null, 'high', 'low');
  const parts = descriptionParts(description, hasValidChapters(description) ? chaptersOf(description).length : 0, hashtags);
  if (parts.playlists > 0 && video.madeForKids) {
    add('metadata', 'strength', `The description links ${parts.playlists} playlist${parts.playlists > 1 ? 's' : ''}: with end screens and cards off on kids’ videos, it’s one of the few ways left to point viewers to more.`, null, 'high', 'medium');
  } else if (parts.playlists + parts.videoLinks >= 2) {
    add('metadata', 'note', `The description points to ${parts.playlists + parts.videoLinks} more of the channel’s videos or playlists.`, null, 'high', 'low');
  }
  if (parts.sponsor) add('metadata', 'note', 'The description mentions a sponsor, code or discount: the channel also earns from brand deals.', null, 'medium', 'low');

  // Tags its best videos share (the tags themselves are public).
  const ranked = others.filter((v) => publicFormat(v.durationSec) === format && v.views !== null);
  const standoutVideos = ranked.filter((v) => judgeVideo(v, baselines, now).isOutlier);
  const tagSource = standoutVideos.length >= 2 ? standoutVideos : [...ranked].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);
  const best = new Set(tagSource.map((v) => v.id));
  const overlap = tagOverlap(video.tags, tagSource.map((v) => v.tags ?? []), ranked.filter((v) => !best.has(v.id)).map((v) => v.tags ?? []));

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
    patterns,
    description: parts,
    tags: { all: video.tags.slice(0, 60), ...overlap, from: tagSource.length < 2 ? null : standoutVideos.length >= 2 ? 'standouts' : 'top' },
    madeForKids: video.madeForKids,
  };
}
