/**
 * Display levels for the views-check numbers: critical / error / warning / ok. These colour the
 * report's tiles and cells only; the findings themselves come from VIEWS_RULES. Pure, so the browser
 * can use it. The boundaries are Rendoza's: YouTube publishes no benchmarks for these.
 */
export type Level = 'critical' | 'error' | 'warning' | 'ok';

export type LevelMetric = 'swipeAway' | 'firstDaysShare' | 'shortsFeedShare' | 'avgViewPct' | 'relativeRetention';

interface Bands {
  /** true: a higher number is worse. */
  higherIsWorse: boolean;
  /** Boundaries in order ok → warning → error → critical. */
  warning: number;
  error: number;
  critical: number;
}

export const LEVEL_BANDS: Record<LevelMetric, Bands> = {
  /**
   * Estimated share of plays swiped away (0–1), on creators' Shorts benchmarks: up to 30% good,
   * 35–40% average, 45%+ poor (stops reaching new viewers); 60%+ critical is Rendoza's.
   */
  swipeAway: { higherIsWorse: true, warning: 0.35, error: 0.45, critical: 0.6 },
  /** Share of views in the first 2 days (0–1): views that all arrive at once then stop. */
  firstDaysShare: { higherIsWorse: true, warning: 0.6, error: 0.75, critical: 0.9 },
  /** Share of views from the Shorts feed (0–1): healthy Shorts get most views there. */
  shortsFeedShare: { higherIsWorse: false, warning: 0.6, error: 0.4, critical: 0.2 },
  /** Average % viewed (0–100). */
  avgViewPct: { higherIsWorse: false, warning: 50, error: 40, critical: 30 },
  /** relativeRetentionPerformance (0–1, 0.5 typical for similar videos). */
  relativeRetention: { higherIsWorse: false, warning: 0.5, error: 0.4, critical: 0.3 },
};

export function levelOf(metric: LevelMetric, value: number | null): Level | null {
  if (value === null || !Number.isFinite(value)) return null;
  const b = LEVEL_BANDS[metric];
  if (b.higherIsWorse) return value >= b.critical ? 'critical' : value >= b.error ? 'error' : value >= b.warning ? 'warning' : 'ok';
  return value < b.critical ? 'critical' : value < b.error ? 'error' : value < b.warning ? 'warning' : 'ok';
}

/** Swipe-away in words, on the same benchmarks: viral ≤20%, good ≤30%, average <45%, poor 45%+. */
export function swipeTier(swipeAway: number | null): string | null {
  if (swipeAway === null || !Number.isFinite(swipeAway)) return null;
  if (swipeAway <= 0.2) return 'Viral level';
  if (swipeAway <= 0.3) return 'Good';
  if (swipeAway < 0.45) return 'Average';
  return 'Poor';
}

export const LEVEL_LABEL: Record<Level, string> = { critical: 'Critical', error: 'Poor', warning: 'Watch', ok: 'OK' };
