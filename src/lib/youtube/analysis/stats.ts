import type { Confidence } from '../types';

/** Median of the finite numbers; null for an empty list. */
export function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Coefficient of variation (stdev / mean); null with fewer than 2 values or a zero mean. */
export function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Percent change, only when the previous value is a real, non-zero baseline. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Confidence from how many data points a finding rests on. */
export function confidenceFromSample(n: number, thresholds = { medium: 4, high: 8 }): Confidence {
  if (n >= thresholds.high) return 'high';
  if (n >= thresholds.medium) return 'medium';
  return 'low';
}

/** The lower of two confidences. */
export function minConfidence(a: Confidence, b: Confidence): Confidence {
  const order: Confidence[] = ['low', 'medium', 'high'];
  return order[Math.min(order.indexOf(a), order.indexOf(b))];
}

export const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Median absolute deviation (unscaled); null for an empty list. */
export function mad(values: number[]): number | null {
  const m = median(values);
  if (m === null) return null;
  return median(values.filter(Number.isFinite).map((v) => Math.abs(v - m)));
}
