import type { Confidence, RetentionAnomaly, RetentionPoint } from '../types';
import { RULES } from './rules-config';
import { median } from './stats';

const R = RULES.retention;

/** Keeps valid points (0 ≤ ratio ≤ 1, finite watch ratio) in time order. */
export function normalizeRetention(points: RetentionPoint[]): RetentionPoint[] {
  return points
    .filter((p) => Number.isFinite(p.ratio) && p.ratio >= 0 && p.ratio <= 1 && Number.isFinite(p.watchRatio) && p.watchRatio >= 0)
    .sort((a, b) => a.ratio - b.ratio);
}

/** Watch ratio at a moment, linearly interpolated between the two nearest points. */
export function watchRatioAt(points: RetentionPoint[], ratio: number): number | null {
  if (points.length === 0) return null;
  if (ratio <= points[0].ratio) return points[0].watchRatio;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (ratio <= b.ratio) {
      const t = (ratio - a.ratio) / (b.ratio - a.ratio || 1);
      return a.watchRatio + t * (b.watchRatio - a.watchRatio);
    }
  }
  return points[points.length - 1].watchRatio;
}

function severity(magnitude: number, notable: number, major: number): RetentionAnomaly['severity'] {
  return magnitude >= major ? 'major' : magnitude >= notable ? 'notable' : 'minor';
}

/**
 * Finds retention signals worth a look. Normal decay is expected: a drop only counts when it
 * is much steeper than the curve's own typical step, and the intro is reported separately.
 */
export function detectRetentionAnomalies(
  videoId: string,
  rawPoints: RetentionPoint[],
  durationSec: number | null,
  periodViews: number
): RetentionAnomaly[] {
  const points = normalizeRetention(rawPoints);
  if (points.length < 10) return [];

  const confidence: Confidence = periodViews >= R.minViewsForHighConfidence ? 'medium' : 'low';
  const toSec = (ratio: number) => (durationSec ? Math.round(ratio * durationSec) : null);
  const anomalies: RetentionAnomaly[] = [];

  // Early exit: share of viewers still watching at 30 seconds.
  if (durationSec && durationSec > R.earlyExitSec * 2) {
    const at = R.earlyExitSec / durationSec;
    const watching = watchRatioAt(points, at);
    if (watching !== null && watching < R.earlyExitWatchRatio) {
      const lostPts = (1 - watching) * 100;
      anomalies.push({
        videoId,
        kind: 'early_exit',
        atSec: R.earlyExitSec,
        atRatio: at,
        magnitude: lostPts,
        severity: severity(lostPts, 45, 60),
        confidence,
      });
    }
  }

  // Drops and spikes need enough viewers; on small samples the curve is mostly noise.
  if (periodViews >= R.minViewsForShape) {
    // Steep drops: a step much larger than the curve's median step, after the intro.
    const steps = points.slice(1).map((p, i) => ({ at: p.ratio, drop: (points[i].watchRatio - p.watchRatio) * 100 }));
    const typicalDrop = median(steps.map((s) => Math.max(0, s.drop))) ?? 0;
    const threshold = Math.max(R.steepDropMinPoints, typicalDrop * R.steepDropMultiplier);

    const drops = steps
      .filter((step) => step.at > R.ignoreIntroRatio && step.drop > threshold)
      .sort((a, b) => b.drop - a.drop)
      .slice(0, R.maxPerKind);
    for (const step of drops) {
      anomalies.push({
        videoId,
        kind: 'steep_drop',
        atSec: toSec(step.at),
        atRatio: step.at,
        magnitude: step.drop,
        severity: severity(step.drop, threshold * 1.5, threshold * 2.5),
        confidence,
      });
    }

    // Rewatch spikes: viewers going back to watch a moment again.
    const spikes = steps
      .filter((step) => step.drop < -R.rewatchSpikePoints)
      .sort((a, b) => a.drop - b.drop)
      .slice(0, R.maxPerKind);
    for (const step of spikes) {
      anomalies.push({
        videoId,
        kind: 'rewatch_spike',
        atSec: toSec(step.at),
        atRatio: step.at,
        magnitude: -step.drop,
        severity: severity(-step.drop, 4, 8),
        confidence,
      });
    }
  }

  // Weak stretches compared with similar-length YouTube videos, merged into continuous runs.
  const relative = points.map((p) => p.relativePerformance);
  const runs: { start: number; worst: number }[] = [];
  let inRun = false;
  for (let i = 0; i + R.weakStretchPoints <= relative.length; i += R.weakStretchPoints) {
    const window = relative.slice(i, i + R.weakStretchPoints).filter((v): v is number => v !== null);
    const avg = window.length >= R.weakStretchPoints / 2 ? window.reduce((sum, v) => sum + v, 0) / window.length : null;
    if (avg !== null && avg < R.weakRelative) {
      if (inRun) runs[runs.length - 1].worst = Math.min(runs[runs.length - 1].worst, avg);
      else runs.push({ start: i, worst: avg });
      inRun = true;
    } else {
      inRun = false;
    }
  }
  for (const run of runs) {
    anomalies.push({
      videoId,
      kind: 'weak_vs_similar',
      atSec: toSec(points[run.start].ratio),
      atRatio: points[run.start].ratio,
      magnitude: run.worst,
      severity: run.worst < 0.2 ? 'major' : run.worst < 0.3 ? 'notable' : 'minor',
      confidence,
    });
  }

  return anomalies;
}
