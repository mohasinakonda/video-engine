/**
 * Channel audit, deterministic part (docs/audit-plan.md §3). Pure: public uploads in, patterns
 * out. "What works" compares the channel's standouts with its weakest videos, each judged
 * against the channel's own usual for the same format. Observations, not causes.
 */
import type { ThumbnailFindings } from '../analysis/thumbnails';
import { coefficientOfVariation, median } from '../analysis/stats';
import { profileChannel } from '../discover/competitor-analysis';
import { FORMAT_LABELS, MECHANISM_LABELS, ruleFormats, titleMechanisms, type ContentFormat, type TitleMechanism } from '../discover/formats';
import { ageInDays, judgeVideo, publicBaselines, publicFormat } from '../discover/outliers';
import type { MarketVideo, PublicChannel, PublicFormat } from '../discover/types';
import type { Confidence } from '../types';
import { sortFindings, type AuditFinding, type FindingArea, type FindingKind } from './video-audit';

/** Each side of a comparison needs this many videos. */
export const MIN_GROUP = 3;
/** A trait must differ by at least this share between standouts and weak videos to be stated. */
export const MIN_SPLIT = 0.4;
/** Below half the channel's usual counts as weak. */
const WEAK_RATIO = 0.5;

export interface RankedVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  views: number;
  ratio: number;
  format: PublicFormat;
}

export interface ChannelAuditResult {
  channel: PublicChannel;
  stats: {
    videosRead: number;
    judged: number;
    standouts: number;
    weak: number;
    hitRate: number | null;
    uploadsLast30Days: number;
    uploadsLast90Days: number;
    medianDaysBetweenUploads: number | null;
    shortsShare: number | null;
  };
  standouts: RankedVideo[];
  weakest: RankedVideo[];
  findings: AuditFinding[];
  limitations: string[];
}

const share = (n: number, total: number) => (total ? n / total : 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Ranks every judgeable video by views ÷ the channel's usual for its format. */
export function rankVideos(videos: MarketVideo[], now: Date): RankedVideo[] {
  const baselines = publicBaselines(videos, now);
  return videos
    .flatMap((v) => {
      const j = judgeVideo(v, baselines, now);
      const format = publicFormat(v.durationSec);
      return j.eligible && j.ratio !== null && format && v.views !== null ? [{ id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, views: v.views, ratio: Math.round(j.ratio * 100) / 100, format, outlier: j.isOutlier }] : [];
    })
    .sort((a, b) => b.ratio - a.ratio)
    .map(({ outlier: _o, ...r }) => r);
}

/** Traits that clearly separate standouts from weak videos. */
function splitFindings<T extends string>(
  top: { id: string; title: string }[],
  weak: { id: string; title: string }[],
  traitsOf: (title: string) => T[],
  label: (t: T) => string,
  area: FindingArea
): AuditFinding[] {
  if (top.length < MIN_GROUP || weak.length < MIN_GROUP) return [];
  const all = new Set<T>([...top, ...weak].flatMap((v) => traitsOf(v.title)));
  const out: AuditFinding[] = [];
  all.forEach((trait) => {
    const t = top.filter((v) => traitsOf(v.title).includes(trait)).length;
    const w = weak.filter((v) => traitsOf(v.title).includes(trait)).length;
    const diff = share(t, top.length) - share(w, weak.length);
    if (Math.abs(diff) < MIN_SPLIT) return;
    const confidence: Confidence = Math.min(top.length, weak.length) >= 6 ? 'medium' : 'low';
    out.push({
      id: `${area}_${trait}`,
      area,
      kind: diff > 0 ? 'strength' : 'weakness',
      statement: diff > 0 ? `Its standouts use ${label(trait)} far more than its weakest videos.` : `Its weakest videos use ${label(trait)} far more than its standouts.`,
      evidence: `${t} of ${top.length} standouts vs ${w} of ${weak.length} weakest videos.`,
      confidence,
    });
  });
  return out;
}

export function auditChannel(channel: PublicChannel, videos: MarketVideo[], now: Date, mine: MarketVideo[] | null = null): ChannelAuditResult {
  const findings: AuditFinding[] = [];
  const limitations: string[] = [];
  const add = (area: FindingArea, kind: FindingKind, statement: string, evidence: string | null, confidence: Confidence) =>
    findings.push({ id: `${area}_${findings.length + 1}`, area, kind, statement, evidence, confidence });

  const { profile } = profileChannel(channel, videos, 365, now);
  const ranked = rankVideos(videos, now);
  const baselines = publicBaselines(videos, now);
  const standoutIds = new Set(videos.filter((v) => judgeVideo(v, baselines, now).isOutlier).map((v) => v.id));
  const standouts = ranked.filter((r) => standoutIds.has(r.id));
  const weakest = ranked.filter((r) => r.ratio < WEAK_RATIO).reverse();
  const hitRate = ranked.length ? standouts.length / ranked.length : null;

  if (ranked.length < 6) limitations.push(`Only ${ranked.length} of its videos could be compared with its usual, so patterns can’t be read yet.`);

  // ─── Hit rate ─────────────────────────────────────────────────────────────
  if (hitRate !== null && ranked.length >= 6) {
    const evidence = `${plural(standouts.length, 'video')} of ${ranked.length} compared beat its usual by 2× or more.`;
    if (hitRate >= 0.15) add('performance', 'strength', 'It produces standouts often.', evidence, 'medium');
    else if (standouts.length === 0) add('performance', 'note', 'None of its recent videos clearly beat its usual: its views are steady rather than hit-driven.', evidence, 'medium');
    else add('performance', 'note', 'Standouts are occasional.', evidence, 'medium');
  }

  // ─── What separates standouts from weak videos ────────────────────────────
  findings.push(...splitFindings(standouts, weakest, (t) => titleMechanisms(t), (m: TitleMechanism) => MECHANISM_LABELS[m].toLowerCase(), 'title'));
  findings.push(
    ...splitFindings(standouts, weakest, (t) => [ruleFormats(t).primary].filter((f): f is ContentFormat => f !== null), (f: ContentFormat) => `the ${FORMAT_LABELS[f].toLowerCase()} format`, 'pattern')
  );
  if (standouts.length >= MIN_GROUP && weakest.length >= MIN_GROUP) {
    const len = (list: RankedVideo[]) => median(list.map((v) => v.title.length)) as number;
    const [a, b] = [len(standouts), len(weakest)];
    if (Math.abs(a - b) >= 15) add('title', 'note', `Its standouts have ${a < b ? 'shorter' : 'longer'} titles.`, `About ${Math.round(a)} characters vs ${Math.round(b)} on its weakest videos.`, 'low');

    const dur = (list: RankedVideo[]) => median(list.filter((v) => v.format === 'video').map((v) => videos.find((x) => x.id === v.id)?.durationSec ?? 0).filter(Boolean));
    const [da, db] = [dur(standouts), dur(weakest)];
    if (da && db && (da / db >= 1.5 || db / da >= 1.5)) {
      add('pattern', 'note', `Its standout long videos are ${da > db ? 'longer' : 'shorter'} than its weakest.`, `About ${Math.round(da / 60)} min vs ${Math.round(db / 60)} min.`, 'low');
    }
  }

  // Shorts vs long-form: which one hits for this channel.
  const rateOf = (f: PublicFormat) => {
    const judged = ranked.filter((r) => r.format === f);
    return judged.length >= 5 ? { rate: judged.filter((r) => standoutIds.has(r.id)).length / judged.length, n: judged.length } : null;
  };
  const [shorts, longs] = [rateOf('short'), rateOf('video')];
  if (shorts && longs && Math.abs(shorts.rate - longs.rate) >= 0.2) {
    const better = shorts.rate > longs.rate ? 'Shorts' : 'long-form videos';
    add('pattern', 'strength', `Its ${better} break out more often.`, `${Math.round(shorts.rate * 100)}% of ${shorts.n} Shorts vs ${Math.round(longs.rate * 100)}% of ${longs.n} long videos were standouts.`, 'medium');
  }

  // ─── Rhythm ───────────────────────────────────────────────────────────────
  const newest = videos.length ? Math.min(...videos.map((v) => ageInDays(v.publishedAt, now))) : null;
  if (newest !== null && newest > 30) add('rhythm', 'weakness', `No uploads in the last ${Math.floor(newest)} days.`, null, 'high');
  else if (profile.uploadsLast90Days >= 3) {
    const recent = videos.filter((v) => ageInDays(v.publishedAt, now) <= 90).map((v) => Date.parse(v.publishedAt)).sort((a, b) => b - a);
    const gaps = recent.slice(1).map((t, i) => (recent[i] - t) / 86_400_000);
    const cv = coefficientOfVariation(gaps);
    const evidence = `${plural(profile.uploadsLast90Days, 'upload')} in 90 days, usually ${profile.medianDaysBetweenUploads} days apart.`;
    add('rhythm', cv !== null && cv >= 1 ? 'note' : 'strength', cv !== null && cv >= 1 ? 'Uploads come in bursts rather than a steady rhythm.' : 'It uploads on a steady rhythm.', evidence, 'medium');
  }

  // ─── You vs them ──────────────────────────────────────────────────────────
  if (mine && mine.length >= 5) {
    const topMech = (() => {
      const counts = new Map<TitleMechanism, number>();
      standouts.forEach((v) => titleMechanisms(v.title).forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1)));
      const [best] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      return best && best[1] >= MIN_GROUP && best[1] / standouts.length >= 0.5 ? best[0] : null;
    })();
    if (topMech) {
      const yourRecent = [...mine].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 10);
      const uses = yourRecent.filter((v) => titleMechanisms(v.title).includes(topMech)).length;
      add('comparison', 'note', `Their standouts lean on ${MECHANISM_LABELS[topMech].toLowerCase()}; ${uses} of your last ${yourRecent.length} titles use it.`, null, 'low');
    }
    const yourShorts = mine.filter((v) => publicFormat(v.durationSec) === 'short').length / mine.length;
    if (profile.shortsShare !== null && Math.abs(profile.shortsShare - yourShorts) >= 0.3) {
      add('comparison', 'note', `${Math.round(profile.shortsShare * 100)}% of their uploads are Shorts, vs ${Math.round(yourShorts * 100)}% of yours.`, null, 'medium');
    }
    const your90 = mine.filter((v) => ageInDays(v.publishedAt, now) <= 90).length;
    if (profile.uploadsLast90Days >= your90 * 2 && profile.uploadsLast90Days - your90 >= 4) {
      add('comparison', 'note', `They upload far more often: ${profile.uploadsLast90Days} videos in 90 days vs your ${your90}.`, null, 'high');
    }
  }

  limitations.push('YouTube doesn’t share another channel’s click rate, retention or traffic, so patterns come from public views and titles only. They show what goes together, not what causes it.');

  return {
    channel,
    stats: {
      videosRead: videos.length,
      judged: ranked.length,
      standouts: standouts.length,
      weak: weakest.length,
      hitRate: hitRate === null ? null : Math.round(hitRate * 100) / 100,
      uploadsLast30Days: profile.uploadsLast30Days,
      uploadsLast90Days: profile.uploadsLast90Days,
      medianDaysBetweenUploads: profile.medianDaysBetweenUploads,
      shortsShare: profile.shortsShare,
    },
    standouts: standouts.slice(0, 6),
    weakest: weakest.slice(0, 6),
    findings: sortFindings(findings),
    limitations,
  };
}

// ─── Thumbnails: standouts vs weakest ─────────────────────────────────────────

const THUMB_TRAITS: { id: string; label: string; test: (f: ThumbnailFindings) => boolean }[] = [
  { id: 'text', label: 'have text on the image', test: (f) => f.wordCount > 0 },
  { id: 'short_text', label: 'keep text to 4 words or fewer', test: (f) => f.wordCount > 0 && f.wordCount <= 4 },
  { id: 'contrast', label: 'have high contrast', test: (f) => f.contrast === 'high' },
  { id: 'simple', label: 'have a simple background', test: (f) => f.background === 'simple' },
  { id: 'big_subject', label: 'fill most of the frame with the subject', test: (f) => f.subjectSizePct >= 40 },
  { id: 'readable', label: 'stay readable at phone size', test: (f) => f.readableAtSmallSize },
];

/** Thumbnail traits that clearly differ between standouts and weakest videos. Vision-based: medium at most. */
export function thumbnailSplit(top: ThumbnailFindings[], weak: ThumbnailFindings[]): AuditFinding[] {
  if (top.length < MIN_GROUP || weak.length < MIN_GROUP) return [];
  return THUMB_TRAITS.flatMap((trait) => {
    const t = top.filter(trait.test).length;
    const w = weak.filter(trait.test).length;
    const diff = t / top.length - w / weak.length;
    if (Math.abs(diff) < 0.5) return [];
    return [
      {
        id: `thumbnail_${trait.id}`,
        area: 'thumbnail' as const,
        kind: (diff > 0 ? 'strength' : 'weakness') as FindingKind,
        statement: diff > 0 ? `Its standout thumbnails ${trait.label}; its weakest mostly don’t.` : `Its weakest thumbnails ${trait.label} more than its standouts.`,
        evidence: `${t} of ${top.length} standouts vs ${w} of ${weak.length} weakest.`,
        confidence: (Math.min(top.length, weak.length) >= 4 ? 'medium' : 'low') as Confidence,
      },
    ];
  });
}
