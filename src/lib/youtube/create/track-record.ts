/**
 * What the creator's measured videos say (docs/create-plan.md §12). Pure and deterministic:
 * learning-record labels in, grouped tendencies out. Small groups are shrunk toward "no effect",
 * and nothing is shown below the admin's minimum number of videos.
 */
import type { ContentFormat, TitleMechanism } from '../discover/formats';
import type { Bottleneck, ThesisVerdict, ViewsBucket } from './outcome';

/** Shrinkage: an effect needs several videos before it moves far from zero. */
export const SHRINK_K = 3;
/** Confidence in a Discover idea may rise from the track record only from this many videos. */
export const CONFIDENCE_MIN_VIDEOS = 5;

export interface LearningRow {
  publishedVideoId: string;
  projectId: string;
  projectTitle: string;
  checkpointDays: number;
  topicLabel: string | null;
  contentFormat: ContentFormat | null;
  titleMechanism: TitleMechanism | null;
  views: ViewsBucket;
  bottleneck: Bottleneck;
  verdict: ThesisVerdict;
}

export interface GroupStat {
  key: string;
  n: number;
  above: number;
  below: number;
  /** (above − below) / (n + k): −1…1, shrunk toward 0 for small groups. */
  effect: number;
  videos: { projectId: string; title: string; views: ViewsBucket }[];
}

const isAbove = (v: ViewsBucket) => v === 'above' || v === 'well_above';
const isBelow = (v: ViewsBucket) => v === 'below' || v === 'well_below';

/** One row per video: its latest measured checkpoint. Videos never compared are left out. */
export function latestPerVideo(rows: LearningRow[]): LearningRow[] {
  const latest = new Map<string, LearningRow>();
  for (const r of rows) {
    if (r.views === 'unknown') continue;
    const current = latest.get(r.publishedVideoId);
    if (!current || r.checkpointDays > current.checkpointDays) latest.set(r.publishedVideoId, r);
  }
  return Array.from(latest.values());
}

export function groupBy(rows: LearningRow[], keyOf: (r: LearningRow) => string | null): GroupStat[] {
  const groups = new Map<string, LearningRow[]>();
  for (const r of rows) {
    const key = keyOf(r);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return Array.from(groups.entries())
    .map(([key, list]) => {
      const above = list.filter((r) => isAbove(r.views)).length;
      const below = list.filter((r) => isBelow(r.views)).length;
      return {
        key,
        n: list.length,
        above,
        below,
        effect: Math.round(((above - below) / (list.length + SHRINK_K)) * 100) / 100,
        videos: list.map((r) => ({ projectId: r.projectId, title: r.projectTitle, views: r.views })),
      };
    })
    .sort((a, b) => b.n - a.n || b.effect - a.effect);
}

/** A tendency worth stating: enough videos and a clear lean either way. */
export const TENDENCY = 0.15;

export interface LearningSummary {
  measuredVideos: number;
  minVideos: number;
  aboveShare: number | null;
  formats: GroupStat[];
  mechanisms: GroupStat[];
  topics: GroupStat[];
  working: { dimension: 'format' | 'mechanism' | 'topic'; stat: GroupStat }[];
  notWorking: { dimension: 'format' | 'mechanism' | 'topic'; stat: GroupStat }[];
  bottlenecks: { bottleneck: Bottleneck; n: number }[];
  verdicts: { verdict: ThesisVerdict; n: number }[];
}

export function summarize(rows: LearningRow[], minVideos: number): LearningSummary {
  const latest = latestPerVideo(rows);
  const formats = groupBy(latest, (r) => r.contentFormat);
  const mechanisms = groupBy(latest, (r) => r.titleMechanism);
  const topics = groupBy(latest, (r) => r.topicLabel?.trim().toLowerCase() || null).map((g) => ({
    ...g,
    // Show the label as the creator wrote it.
    key: latest.find((r) => r.topicLabel?.trim().toLowerCase() === g.key)?.topicLabel?.trim() ?? g.key,
  }));
  const qualified = [
    ...formats.map((stat) => ({ dimension: 'format' as const, stat })),
    ...mechanisms.map((stat) => ({ dimension: 'mechanism' as const, stat })),
    ...topics.map((stat) => ({ dimension: 'topic' as const, stat })),
  ].filter((g) => g.stat.n >= minVideos);
  const count = <T extends string>(values: T[]) =>
    Array.from(new Set(values))
      .map((v) => ({ v, n: values.filter((x) => x === v).length }))
      .sort((a, b) => b.n - a.n);

  return {
    measuredVideos: latest.length,
    minVideos,
    aboveShare: latest.length ? Math.round((latest.filter((r) => isAbove(r.views)).length / latest.length) * 100) / 100 : null,
    formats,
    mechanisms,
    topics,
    working: qualified.filter((g) => g.stat.effect >= TENDENCY).sort((a, b) => b.stat.effect - a.stat.effect),
    notWorking: qualified.filter((g) => g.stat.effect <= -TENDENCY).sort((a, b) => a.stat.effect - b.stat.effect),
    bottlenecks: count(latest.map((r) => r.bottleneck).filter((b) => b !== 'none' && b !== 'insufficient_data')).map(({ v, n }) => ({ bottleneck: v, n })),
    verdicts: count(latest.map((r) => r.verdict).filter((v) => v !== 'inconclusive')).map(({ v, n }) => ({ verdict: v, n })),
  };
}

// ─── Feedback into Discover ──────────────────────────────────────────────────

/** What Discover needs: format groups, and topic groups with a vector for matching. */
export interface TrackRecordInput {
  minVideos: number;
  formats: Map<string, GroupStat>;
  topics: { stat: GroupStat; vector: number[] }[];
}

export interface TrackRecordSignal {
  /** 0–100; 50 means no lean. */
  score: number;
  n: number;
  effect: number;
  evidence: string;
}

/** Topic groups match an opportunity's topic when their vectors are this close. */
export const TOPIC_MATCH = 0.8;

const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The track-record score for an opportunity: the format's group and the nearest topic group,
 * weighted by their sizes. Null (a missing signal) when neither has enough videos.
 */
export function trackRecordFor(format: string | null, topicCentroid: number[], input: TrackRecordInput | null, formatLabel?: string): TrackRecordSignal | null {
  if (!input) return null;
  const parts: { stat: GroupStat; text: string }[] = [];
  const f = format ? input.formats.get(format) : undefined;
  if (f && f.n >= input.minVideos) parts.push({ stat: f, text: `${plural(f.n, `past ${(formatLabel ?? format ?? '').toLowerCase()} video`)}` });
  const near = input.topics
    .filter((t) => t.stat.n >= input.minVideos && topicCentroid.length > 0)
    .map((t) => ({ t, sim: cosine(t.vector, topicCentroid) }))
    .filter((x) => x.sim >= TOPIC_MATCH)
    .sort((a, b) => b.sim - a.sim)[0];
  if (near) parts.push({ stat: near.t.stat, text: `${plural(near.t.stat.n, 'past video')} on “${near.t.stat.key}”` });
  if (!parts.length) return null;

  const n = parts.reduce((s, p) => s + p.stat.n, 0);
  const effect = parts.reduce((s, p) => s + p.stat.effect * p.stat.n, 0) / n;
  const evidence = parts.map((p) => `Your ${p.text} did better than your usual in ${p.stat.above} of ${p.stat.n} and worse in ${p.stat.below}.`).join(' ');
  return { score: Math.max(0, Math.min(100, Math.round(50 + 50 * effect))), n: Math.max(...parts.map((p) => p.stat.n)), effect: Math.round(effect * 100) / 100, evidence };
}
