/**
 * Pacing: Shorts are watched fast, so a Short's pace sets how long a shot may stay on screen, and
 * each shot's speed says whether it plays in real time, sped up in editing, or in slow motion.
 * Shot lengths in a storyboard are screen time; what Flow must generate follows from the speed.
 */
import type { Shot } from './types';

export const PACES = {
  very_fast: { label: 'Very fast', hint: 'a cut every 1–2s', maxShot: 2, hookMax: 1, shots: [8, 12] },
  fast: { label: 'Fast', hint: 'a cut every 2–3s', maxShot: 3, hookMax: 2, shots: [6, 10] },
  steady: { label: 'Steady', hint: 'satisfying, up to 5s a shot', maxShot: 5, hookMax: 3, shots: [4, 7] },
} as const;
export type Pace = keyof typeof PACES;
export const PACE_IDS = Object.keys(PACES) as Pace[];
export const DEFAULT_PACE: Pace = 'fast';

export const SPEEDS = {
  real_time: { label: 'real time', factor: 1, prompt: 'Brisk, decisive motion at real speed; the action finishes within the shot, no lingering.' },
  fast_forward: { label: 'fast-forward 2×', factor: 2, prompt: 'Natural speed (I speed it up 2× in editing); the whole action completes within the clip.' },
  speed_ramp: { label: 'speed ramp', factor: 1.5, prompt: 'Natural speed with the key moment clearly visible (I ramp the speed in editing: fast in, slow on the key moment).' },
  slow_motion: { label: 'slow motion', factor: 1, prompt: 'Slow motion, smooth and detailed, so the key moment is easy to see.' },
} as const;
export type Speed = keyof typeof SPEEDS;
export const SPEED_IDS = Object.keys(SPEEDS) as Speed[];

/** Seconds Flow must generate to fill the shot's screen time at its speed. */
export const rawSeconds = (shot: Pick<Shot, 'seconds' | 'speed'>) => Math.ceil(shot.seconds * SPEEDS[shot.speed ?? 'real_time'].factor);

/** The editing step for a shot's speed, or null for real time. */
export function speedEdit(shot: Pick<Shot, 'seconds' | 'speed'>): string | null {
  switch (shot.speed ?? 'real_time') {
    case 'fast_forward':
      return `speed up 2× to ${shot.seconds}s`;
    case 'speed_ramp':
      return `ramp: fast in, slow on the key moment, ${shot.seconds}s in all`;
    case 'slow_motion':
      return 'keep the slow motion';
    default:
      return null;
  }
}
