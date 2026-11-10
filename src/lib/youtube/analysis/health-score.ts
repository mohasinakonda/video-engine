/**
 * Rendoza health score (0–100) from a finished diagnosis: six parts, each scored 0–100 from
 * the channel's own measured numbers, weighted, and shown with its working. Pure, so it runs
 * in the browser on any saved report. A part without data is left out and the rest reweighted.
 */
import type { MetricValue, VideoAnalysis } from '../types';
import { DISCOVERY_SOURCES } from './rules-config';
import { coefficientOfVariation, median } from './stats';

export type HealthPartId = 'growth' | 'clicks' | 'retention' | 'discovery' | 'consistency' | 'subscribers';
export type HealthBand = 'healthy' | 'fair' | 'attention';

export interface HealthPart {
  id: HealthPartId;
  name: string;
  /** 0–1; the weights of all six add up to 1. */
  weight: number;
  /** 0–100, or null when YouTube didn't return the data. */
  score: number | null;
  /** The measured number behind the score, in words. */
  detail: string;
  /** What this part means when it is the main drag. */
  drag: string;
}

export interface HealthScore {
  /** null when there isn't enough data for a fair score. */
  score: number | null;
  band: HealthBand | null;
  parts: HealthPart[];
  usedParts: number;
  /** The part that costs the most points, if any. */
  mainDrag: HealthPart | null;
  /** Why there is no score, when there isn't one. */
  reason: string | null;
}

export const HEALTH = {
  minVideosWithViews: 5,
  bands: { healthy: 70, fair: 40 },
  weights: { growth: 0.25, clicks: 0.2, retention: 0.2, discovery: 0.15, consistency: 0.1, subscribers: 0.1 },
  /** View change: −50% scores 0, +50% scores 100. */
  growth: { low: -50, high: 50 },
  /** Impressions CTR: 0% → 0, 2% → 20, 10%+ → 100 (half of channels sit between 2% and 10%). */
  clicks: { floor: 0.02, floorScore: 20, top: 0.1 },
  /** Average % viewed: 20% → 0, 60%+ → 100. Rendoza's bands: YouTube publishes no benchmark. */
  retention: { low: 20, high: 60 },
  /** Share of views from YouTube's recommendations: 30% → 0, 60%+ → 100. */
  discovery: { low: 30, high: 60 },
  /**
   * Days since the last upload: 7 or fewer → 100, 30+ → 0. Then regularity scales it: gaps that
   * vary little (coefficient of variation ≤ 0.5) keep it all, very uneven gaps (≥ 2, e.g. a burst
   * then silence) keep a quarter; and a median gap over 14 days scales it down too.
   */
  consistency: { fresh: 7, stale: 30, maxMedianGap: 14, steadyCv: 0.5, erraticCv: 2, erraticFactor: 0.25, minGaps: 3 },
  /** Net subscribers per 1,000 views: 0 or fewer → 0, 10+ → 100. */
  subscribers: { high: 10 },
  /** Period views a part needs before its number means anything; below this it isn't scored. */
  minViews: { retention: 100, discovery: 100, subscribers: 500 },
} as const;

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const linear = (value: number, low: number, high: number) => clamp(((value - low) / (high - low)) * 100);
const DAY = 86_400_000;

export interface HealthInput {
  metrics: MetricValue[];
  traffic: { source: string; views: number; sharePct: number }[] | null;
  videos: VideoAnalysis[];
  current: { days: number };
  generatedAt: string;
}

export function healthBand(score: number): HealthBand {
  return score >= HEALTH.bands.healthy ? 'healthy' : score >= HEALTH.bands.fair ? 'fair' : 'attention';
}

export function computeHealthScore(input: HealthInput): HealthScore {
  const W = HEALTH.weights;
  const metric = (key: MetricValue['key']) => input.metrics.find((m) => m.key === key);
  const parts: HealthPart[] = [];

  const views = metric('views');
  const change = views?.changePct ?? null;
  parts.push({
    id: 'growth',
    name: 'Growth',
    weight: W.growth,
    score: change === null ? null : Math.round(linear(change, HEALTH.growth.low, HEALTH.growth.high)),
    detail: change === null ? 'No fair comparison with the previous period' : `Views ${change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(change))}% vs the previous ${input.current.days} days`,
    drag: change !== null && change < 0 ? `views fell ${Math.abs(Math.round(change))}% vs the previous ${input.current.days} days` : 'views aren’t growing',
  });

  const ctr = metric('ctr')?.value ?? null;
  const C = HEALTH.clicks;
  parts.push({
    id: 'clicks',
    name: 'Clicks (CTR)',
    weight: W.clicks,
    score:
      ctr === null ? null : Math.round(ctr < C.floor ? (ctr / C.floor) * C.floorScore : C.floorScore + linear(ctr, C.floor, C.top) * ((100 - C.floorScore) / 100)),
    detail: ctr === null ? 'Impressions and CTR not available yet' : `CTR ${(ctr * 100).toFixed(1)}%; half of channels sit between 2% and 10%`,
    drag: 'people see your videos but don’t click',
  });

  const periodViews = views?.value ?? null;
  const tooFew = (needed: number, have: number | null) => `Not enough views yet to judge (${(have ?? 0).toLocaleString('en-US')} in this period; needs ${needed.toLocaleString('en-US')})`;

  // YouTube reports 0% when it has no average for the period: that is missing data, not a score.
  const rawPct = metric('avgViewPct')?.value ?? null;
  const avgPct = rawPct !== null && rawPct > 0 ? rawPct : null;
  const retentionReady = (periodViews ?? 0) >= HEALTH.minViews.retention;
  parts.push({
    id: 'retention',
    name: 'Retention',
    weight: W.retention,
    score: avgPct === null || !retentionReady ? null : Math.round(linear(avgPct, HEALTH.retention.low, HEALTH.retention.high)),
    detail: !retentionReady
      ? tooFew(HEALTH.minViews.retention, periodViews)
      : avgPct === null
        ? 'YouTube hasn’t reported average % viewed for this period'
        : `Viewers watch ${Math.round(avgPct)}% of a video on average`,
    drag: 'viewers leave your videos early',
  });

  const trafficViews = input.traffic?.reduce((s, t) => s + t.views, 0) ?? 0;
  const discoveryShare = input.traffic?.length
    ? input.traffic.filter((t) => DISCOVERY_SOURCES.has(t.source)).reduce((s, t) => s + t.sharePct, 0)
    : null;
  const discoveryReady = trafficViews >= HEALTH.minViews.discovery;
  parts.push({
    id: 'discovery',
    name: 'Discovery',
    weight: W.discovery,
    score: discoveryShare === null || !discoveryReady ? null : Math.round(linear(discoveryShare, HEALTH.discovery.low, HEALTH.discovery.high)),
    detail:
      discoveryShare === null
        ? 'Traffic sources not available'
        : !discoveryReady
          ? tooFew(HEALTH.minViews.discovery, trafficViews)
          : `${Math.round(discoveryShare)}% of views from YouTube’s recommendations`,
    drag: 'YouTube rarely recommends your videos',
  });

  const now = Date.parse(input.generatedAt);
  const times = input.videos.map((v) => Date.parse(v.publishedAt)).filter(Number.isFinite).sort((a, b) => b - a);
  let consistency: number | null = null;
  let consistencyDetail = 'No uploads to measure';
  if (times.length && Number.isFinite(now)) {
    const K = HEALTH.consistency;
    const since = Math.max(0, Math.floor((now - times[0]) / DAY));
    const gaps = times.slice(1, 11).map((t, i) => (times[i] - t) / DAY);
    const medianGap = median(gaps);
    const cv = gaps.length >= K.minGaps ? coefficientOfVariation(gaps) : null;
    const recency = since <= K.fresh ? 100 : clamp(100 - linear(since, K.fresh, K.stale));
    const spacing = medianGap !== null && medianGap > K.maxMedianGap ? K.maxMedianGap / medianGap : 1;
    const regularity = cv === null ? 1 : 1 - (linear(cv, K.steadyCv, K.erraticCv) / 100) * (1 - K.erraticFactor);
    consistency = Math.round(recency * spacing * regularity);
    const last = since === 0 ? 'Last upload today' : `Last upload ${since} day${since === 1 ? '' : 's'} ago`;
    const rhythm =
      medianGap === null ? '' : medianGap < 1 ? '; often several uploads a day' : `; about every ${Math.round(medianGap)} day${Math.round(medianGap) === 1 ? '' : 's'} (median)`;
    const uneven = cv !== null && cv > 1 ? ', but the gaps vary a lot (bursts, then pauses)' : '';
    consistencyDetail = `${last}${rhythm}${uneven}`;
  }
  parts.push({ id: 'consistency', name: 'Consistency', weight: W.consistency, score: consistency, detail: consistencyDetail, drag: 'uploads are irregular or have stopped' });

  const net = metric('netSubscribers')?.value ?? null;
  const per1000 = net !== null && periodViews ? (net / periodViews) * 1000 : null;
  const subscribersReady = (periodViews ?? 0) >= HEALTH.minViews.subscribers;
  parts.push({
    id: 'subscribers',
    name: 'Subscribers',
    weight: W.subscribers,
    score: per1000 === null || !subscribersReady ? null : Math.round(linear(per1000, 0, HEALTH.subscribers.high)),
    detail: !subscribersReady
      ? tooFew(HEALTH.minViews.subscribers, periodViews)
      : per1000 === null
        ? 'Subscriber change not available'
        : `${per1000.toFixed(1)} net subscribers per 1,000 views`,
    drag: 'views aren’t turning into subscribers',
  });

  const withViews = input.videos.filter((v) => (v.stats?.views ?? 0) > 0).length;
  const used = parts.filter((p) => p.score !== null);
  if (withViews < HEALTH.minVideosWithViews || used.length < 3) {
    return {
      score: null,
      band: null,
      parts,
      usedParts: used.length,
      mainDrag: null,
      reason: `We need at least ${HEALTH.minVideosWithViews} videos with views in this period for a fair score. Keep posting and check again.`,
    };
  }
  const totalWeight = used.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(used.reduce((s, p) => s + (p.score as number) * p.weight, 0) / totalWeight);
  const mainDrag = [...used].sort((a, b) => (100 - (b.score as number)) * b.weight - (100 - (a.score as number)) * a.weight)[0];
  return {
    score,
    band: healthBand(score),
    parts,
    usedParts: used.length,
    mainDrag: mainDrag && (mainDrag.score as number) < 70 ? mainDrag : null,
    reason: null,
  };
}
