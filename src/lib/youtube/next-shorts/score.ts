/**
 * How ready each shot's prompt is, 0–100, with the reasons. It measures the prompt (clear,
 * possible, consistent, fits the model), never promises how the video turns out, and a longer
 * prompt doesn't score higher.
 */
import { analyzeShot } from './complexity';
import { fitGeneration, MODELS, type FlowMode } from './models';
import { rawSeconds } from './pacing';
import type { Issue, Shot, ShotReport, Storyboard } from './types';
import { shotStarts } from './validate';

const VAGUE = /\b(beautiful|awesome|amazing|stunning|epic|cool|nice|perfect|incredible|gorgeous|breathtaking)\b/gi;
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

export function scoreShot(shot: Shot, n: number, issues: Issue[], mode: FlowMode, startsAt: number): ShotReport {
  const c = analyzeShot(shot);
  const reasons: string[] = [];
  let score = 100;
  const take = (points: number, why: string) => {
    if (points <= 0) return;
    score -= points;
    reasons.push(`−${Math.round(points)} ${why}`);
  };

  take(Math.max(0, c.score - 40) * 0.8, `hard to generate (${c.reasons.join('; ') || 'complex'})`);
  for (const i of issues.filter((x) => x.shot === n)) take(i.level === 'block' ? 25 : 8, i.message);
  if (words(shot.action) < 3) take(10, 'the action is too vague to picture');
  for (const [field, value] of [
    ['environment', shot.environment],
    ['lighting', shot.lighting],
    ['composition', shot.composition],
  ] as const) {
    if (words(value) < 3) take(5, `${field} is too thin`);
  }
  const vague = `${shot.subject} ${shot.action} ${shot.environment} ${shot.lighting}`.match(VAGUE) ?? [];
  if (vague.length) take(3 * vague.length, `vague words (${Array.from(new Set(vague.map((v) => v.toLowerCase()))).join(', ')}) instead of what you see`);
  const raw = rawSeconds(shot);
  const generation = fitGeneration(raw, MODELS[mode], shot.references.length > 0);
  if (generation && generation.trim >= 3) take(5, `generates ${generation.seconds}s to use ${raw}s`);
  if (shot.continuity.with && shot.continuity.keep.length === 0) take(5, 'continues another shot but says nothing about what must stay the same');

  return {
    shot: n,
    startsAt,
    complexity: c.score,
    complexityReasons: c.reasons,
    readiness: Math.max(0, Math.min(100, Math.round(score))),
    readinessReasons: reasons,
    generation,
  };
}

export function scoreStoryboard(sb: Storyboard, issues: Issue[], mode: FlowMode): { shots: ShotReport[]; readiness: number } {
  const starts = shotStarts(sb);
  const shots = sb.shots.map((s, i) => scoreShot(s, i + 1, issues, mode, starts[i]));
  const whole = issues.filter((i) => i.shot === null);
  const penalty = whole.reduce((n, i) => n + (i.level === 'block' ? 15 : 5), 0);
  // The weakest shot holds the Short back more than the average shows.
  const avg = shots.reduce((n, s) => n + s.readiness, 0) / Math.max(1, shots.length);
  const min = Math.min(...shots.map((s) => s.readiness), 100);
  return { shots, readiness: Math.max(0, Math.round(avg * 0.6 + min * 0.4 - penalty)) };
}
