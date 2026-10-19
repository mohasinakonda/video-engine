/**
 * Outcome classification (docs/create-plan.md §11.2). Pure and deterministic: measured
 * numbers in, bucketed labels and plain explanations out. Only the labels are ever stored.
 */
import { RULES } from '../analysis/rules-config';
import type { Confidence } from '../types';
import type { Thesis } from './types';

export type ViewsBucket = 'well_above' | 'above' | 'typical' | 'below' | 'well_below' | 'unknown';
export type SignalBucket = 'above' | 'typical' | 'below' | 'unknown';
export type Bottleneck = 'none' | 'discovery' | 'packaging' | 'retention' | 'content_market_mismatch' | 'execution' | 'insufficient_data';
export type ThesisVerdict = 'supported' | 'partly_supported' | 'not_supported' | 'inconclusive';

/** Comparable videos needed before "your usual" means anything. */
export const MIN_BASELINE = 5;
/** Below this many usual views at an age, a ratio is noise ("4 vs 3"). */
export const MIN_BASELINE_VIEWS = 20;
/** Early checkpoints are a first signal only; the thesis is judged from this age. */
export const THESIS_MIN_DAYS = 7;

/** One checkpoint's measurements. Null means not available (the reason goes in limitations). */
export interface Measurement {
  days: number;
  views: number;
  /** Median views of comparable videos at the same age, and how many there were. */
  baselineViews: number | null;
  baselineSample: number;
  avgViewPct: number | null;
  baselineAvgViewPct: number | null;
  /** 0–1, over the video's first `days` days, from the reach report. */
  ctr: number | null;
  impressions: number | null;
  baselineCtr: number | null;
  /** Share of views from browse, suggested and the Shorts feed: this video vs the channel. */
  discoveryShare: number | null;
  channelDiscoveryShare: number | null;
}

export interface Outcome {
  days: number;
  views: ViewsBucket;
  viewsRatio: number | null;
  ctr: SignalBucket;
  retention: SignalBucket;
  discovery: SignalBucket;
  bottleneck: Bottleneck;
  verdict: ThesisVerdict;
  confidence: Confidence;
  /** Plain sentences, built from the labels (no new claims). */
  summary: string;
  thesisText: string | null;
  nextStep: string;
}

const ratio = (a: number | null, b: number | null) => (a === null || b === null || b <= 0 ? null : a / b);

export function viewsBucket(r: number | null): ViewsBucket {
  if (r === null) return 'unknown';
  if (r >= 2) return 'well_above';
  if (r >= 1.25) return 'above';
  if (r >= 0.8) return 'typical';
  if (r >= 0.5) return 'below';
  return 'well_below';
}

/** CTR at or below 70% of usual is weak (Phase 1's packaging rule); 120% or more is strong. */
export function ctrBucket(m: Measurement): SignalBucket {
  const r = ratio(m.ctr, m.baselineCtr);
  if (r === null || (m.impressions ?? 0) < 300) return 'unknown';
  if (r <= RULES.packaging.ctrRatio) return 'below';
  if (r >= 1.2) return 'above';
  return 'typical';
}

/** Average % viewed at or below 80% of usual is weak (Phase 1's retention rule). Needs enough views to mean anything. */
export function retentionBucket(m: Measurement): SignalBucket {
  const r = ratio(m.avgViewPct, m.baselineAvgViewPct);
  if (r === null || m.views < 100) return 'unknown';
  if (r <= RULES.retention.avpRatio) return 'below';
  if (r >= 1.15) return 'above';
  return 'typical';
}

/** Recommendations bringing far fewer of the views than usual means the video wasn't being shown. */
export function discoveryBucket(m: Measurement): SignalBucket {
  const r = ratio(m.discoveryShare, m.channelDiscoveryShare);
  if (r === null || m.views < 50) return 'unknown';
  if (r <= 0.5) return 'below';
  if (r >= 1.3) return 'above';
  return 'typical';
}

export function bottleneckOf(views: ViewsBucket, ctr: SignalBucket, retention: SignalBucket, discovery: SignalBucket): Bottleneck {
  if (views === 'unknown') return 'insufficient_data';
  if (views !== 'below' && views !== 'well_below') return 'none';
  if (ctr === 'below' && retention === 'below') return 'execution';
  if (ctr === 'below') return 'packaging';
  if (retention === 'below') return 'retention';
  if (discovery === 'below') return 'discovery';
  if (ctr === 'unknown' && retention === 'unknown') return 'insufficient_data';
  // Clicked and watched like usual, shown like usual, and still fewer people came: the topic pulled less.
  return 'content_market_mismatch';
}

/**
 * Did Discover's expectation hold? Only judged from day 7 with a real baseline. When packaging
 * or retention held the video back, the topic itself wasn't really tested.
 */
export function verdictOf(days: number, views: ViewsBucket, bottleneck: Bottleneck, thesis: Thesis | null): ThesisVerdict {
  if (!thesis || views === 'unknown' || days < THESIS_MIN_DAYS) return 'inconclusive';
  if (views === 'above' || views === 'well_above') return 'supported';
  if (views === 'typical') return 'partly_supported';
  if (bottleneck === 'packaging' || bottleneck === 'retention' || bottleneck === 'execution') return 'inconclusive';
  return 'not_supported';
}

export function confidenceOf(m: Measurement, views: ViewsBucket): Confidence {
  if (views === 'unknown' || m.days < 2) return 'low';
  const sample: Confidence = m.baselineSample >= 12 ? 'high' : m.baselineSample >= 8 ? 'medium' : 'low';
  const age: Confidence = m.days >= THESIS_MIN_DAYS ? 'high' : 'medium';
  const order: Confidence[] = ['low', 'medium', 'high'];
  return order[Math.min(order.indexOf(sample), order.indexOf(age))];
}

const VIEWS_TEXT: Record<ViewsBucket, string> = {
  well_above: 'far more views than your usual video at the same age',
  above: 'more views than your usual video at the same age',
  typical: 'about as many views as your usual video at the same age',
  below: 'fewer views than your usual video at the same age',
  well_below: 'far fewer views than your usual video at the same age',
  unknown: 'views we can’t compare yet',
};

const BOTTLENECK_TEXT: Record<Bottleneck, string> = {
  none: 'Nothing is holding it back.',
  discovery: 'YouTube showed it less than usual: recommendations brought fewer of its views.',
  packaging: 'People saw it but clicked less than usual: the title and thumbnail are the weak point.',
  retention: 'People clicked as usual but left sooner: the video itself is the weak point, often the opening.',
  content_market_mismatch: 'It was clicked and watched like your usual videos, yet fewer people came: the topic pulled less than expected.',
  execution: 'Both the click rate and how long people watched were below your usual.',
  insufficient_data: 'There isn’t enough data to say what held it back yet.',
};

const NEXT_STEP: Record<Bottleneck, string> = {
  none: 'Note what worked here (topic, title approach, opening) and reuse it.',
  discovery: 'Give it time, and check it in Channel Doctor’s video check-up for traffic sources.',
  packaging: 'Try a different title or thumbnail from your packaging concepts, then check again in a few days.',
  retention: 'Look at where viewers leave in Channel Doctor’s video check-up; tighten the opening next time.',
  content_market_mismatch: 'Treat this topic as weaker for your audience; Discover will learn from it.',
  execution: 'Review both the packaging and the opening; check where viewers leave in Channel Doctor.',
  insufficient_data: 'Check again at the next checkpoint.',
};

const VERDICT_TEXT: Record<ThesisVerdict, string> = {
  supported: 'The idea held up: it beat your usual.',
  partly_supported: 'The idea partly held up: it did about as well as your usual.',
  not_supported: 'The idea didn’t hold up: the topic pulled fewer viewers than expected.',
  inconclusive: 'Too early, or something else held the video back, so the idea wasn’t really tested.',
};

/** What Discover expected, in words. */
export function expectationText(t: Thesis): string {
  return `Discover rated this idea ${t.confidence} confidence, with ${t.channelFit} fit for your channel and ${t.competition} competition.`;
}

export function classify(m: Measurement, thesis: Thesis | null): Outcome {
  const r = m.baselineSample >= MIN_BASELINE && (m.baselineViews ?? 0) >= MIN_BASELINE_VIEWS ? ratio(m.views, m.baselineViews) : null;
  const views = viewsBucket(r);
  const ctr = ctrBucket(m);
  const retention = retentionBucket(m);
  const discovery = discoveryBucket(m);
  const bottleneck = bottleneckOf(views, ctr, retention, discovery);
  const verdict = verdictOf(m.days, views, bottleneck, thesis);
  const early = m.days < THESIS_MIN_DAYS ? ' This is an early signal.' : '';
  return {
    days: m.days,
    views,
    viewsRatio: r === null ? null : Math.round(r * 100) / 100,
    ctr,
    retention,
    discovery,
    bottleneck,
    verdict,
    confidence: confidenceOf(m, views),
    summary: `After ${m.days} day${m.days === 1 ? '' : 's'}, it has ${VIEWS_TEXT[views]}. ${BOTTLENECK_TEXT[bottleneck]}${early}`,
    thesisText: thesis ? VERDICT_TEXT[verdict] : null,
    nextStep: NEXT_STEP[bottleneck],
  };
}
