/**
 * shot-planner.ts — turns scenes (one image each) into an edited sequence of shots.
 *
 * By default every image is one continuous take: a single smooth camera move across the whole
 * scene (e.g. from the full picture slowly into its subject), so no picture is ever shown twice.
 * Optionally ('several' angles) an image is split into a few framings cut on the narration's
 * natural breaks. Scenes are joined with cuts or transitions chosen by mood.
 * Pure and deterministic: the same input always gives the same edit.
 */

import type { CutPace, ShotType, CameraMotionEffect, MotionProfile, TransitionType } from '@/types';

/** Where the camera looks: zoom ≥ 1 over a cover-fitted image, centred on (x, y) in image space (0–1). */
export interface Framing {
  zoom: number;
  x: number;
  y: number;
}

export type MoveType = 'push_in' | 'pull_out' | 'drift' | 'hold';
export type ShotSize = 'wide' | 'medium' | 'close';
export type ShotTransition = 'cut' | 'crossfade' | 'dip' | 'zoom_through' | 'whip';

export interface Shot {
  sceneId: number;
  start: number;
  end: number;
  size: ShotSize;
  move: MoveType;
  from: Framing;
  to: Framing;
  /** How this shot starts (the outgoing shot is blended over the last `transitionSec` before `start`). */
  transitionIn: ShotTransition;
  transitionSec: number;
}

export interface SpokenWord {
  word: string;
  start: number;
  end: number;
}

export interface PlannerScene {
  sceneId: number;
  audioStartSec?: number;
  audioEndSec?: number;
  narrationLine?: string;
  cutPace?: CutPace;
  shotType?: ShotType;
  cameraMotion?: CameraMotionEffect;
  motionProfile?: MotionProfile;
}

/** The most detailed point of an image (its likely subject), and a second one when there is one. */
export interface ImageFocus {
  x: number;
  y: number;
  alt?: { x: number; y: number };
}

export interface PlanOptions {
  totalDurationSec: number;
  words?: SpokenWord[];
  /** Focus per sceneId; the image centre is used when missing. */
  focus?: Map<number, ImageFocus>;
  /** Deepest zoom that still looks sharp, from the image size vs the output size. */
  maxZoom: number;
  transitionType: TransitionType | 'auto';
  /** Seconds for crossfades (from the export settings). */
  crossfadeSec?: number;
  /**
   * 'one' (default): each image is a single continuous take. 'several': an image is split into
   * wide / close / medium framings, which can read as the same picture repeated.
   */
  anglesPerImage?: 'one' | 'several';
}

const PACE: Record<CutPace, { target: number; min: number }> = {
  FAST_CUT: { target: 2.2, min: 1.2 },
  NORMAL: { target: 3.4, min: 1.6 },
  ATMOSPHERIC_HOLD: { target: 5.5, min: 3 },
};
const MAX_SHOTS_PER_SCENE = 4;
/** Two framings of the same image must differ at least this much in zoom, or the cut looks like a glitch. */
const MIN_ZOOM_STEP = 1.15;
/** How far a push-in or pull-out travels within its size's band. */
const MOVE_RANGE = 1.06;
const WIDE_BAND: [number, number] = [1, 1.07];
const PUNCTUATION = /[.,!?;:…।—–-]$/;

// ─── Deterministic randomness ───────────────────────────────────────────────

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

// ─── Cut points ────────────────────────────────────────────────────────────

interface CutCandidate {
  t: number;
  score: number;
}

/** Natural places to cut inside [start, end]: pauses between words, stronger after punctuation. */
function cutCandidates(scene: PlannerScene, start: number, end: number, words: SpokenWord[] | undefined): CutCandidate[] {
  const inScene = (words ?? []).filter((w) => w.start >= start - 0.05 && w.start < end);
  if (inScene.length >= 2) {
    const out: CutCandidate[] = [];
    for (let i = 0; i < inScene.length - 1; i++) {
      const cur = inScene[i];
      const next = inScene[i + 1];
      const gap = Math.max(0, next.start - cur.end);
      // Cut just before the next word starts, as editors do.
      out.push({ t: next.start - 0.04, score: Math.min(gap, 0.8) + (PUNCTUATION.test(cur.word.trim()) ? 0.35 : 0) });
    }
    return out;
  }
  // No word timings: estimate from where the punctuation falls in the scene's text.
  const text = (scene.narrationLine ?? '').trim();
  if (!text) return [];
  const out: CutCandidate[] = [];
  const re = /\S+\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const endIdx = m.index + m[0].length;
    if (endIdx >= text.length) break;
    out.push({ t: start + ((end - start) * endIdx) / text.length, score: PUNCTUATION.test(m[0].trim()) ? 0.35 : 0.05 });
  }
  return out;
}

/** Splits [start, end] into `count` shots, each cut at the best natural break near its ideal spot. */
function cutTimes(cands: CutCandidate[], start: number, end: number, count: number, minLen: number): number[] {
  const dur = end - start;
  const cuts: number[] = [];
  let prev = start;
  for (let k = 1; k < count; k++) {
    const ideal = start + (dur * k) / count;
    const remaining = count - k;
    let best: CutCandidate | null = null;
    let bestValue = -Infinity;
    for (const c of cands) {
      if (c.t < prev + minLen || c.t > end - minLen * remaining) continue;
      const value = c.score - (Math.abs(c.t - ideal) / dur) * 2;
      if (value > bestValue) {
        bestValue = value;
        best = c;
      }
    }
    const t = best ? best.t : ideal;
    if (t < prev + minLen || t > end - minLen * remaining) break;
    cuts.push(t);
    prev = t;
  }
  return cuts;
}

// ─── Framing ───────────────────────────────────────────────────────────────

function sizesFor(count: number, shotType: ShotType | undefined, allowClose: boolean): ShotSize[] {
  const scenic = shotType === 'AERIAL_GEOMETRY' || shotType === 'WIDE_ESTABLISHING' || shotType === 'ATMOSPHERIC_MOOD';
  const detail = shotType === 'MACRO_TEXTURE';
  const close: ShotSize = allowClose && !scenic ? 'close' : 'medium';
  const patterns: Record<number, ShotSize[]> = {
    1: [detail ? 'medium' : 'wide'],
    2: ['wide', close],
    3: ['wide', close, 'medium'],
    4: ['wide', close, 'medium', close],
  };
  // Without a close band (or for scenic shots) "close" becomes medium; then no size may repeat
  // back to back, since two cuts in the same band look like a glitch.
  const sizes: ShotSize[] = [];
  for (const size of patterns[count] ?? patterns[1]) {
    const prev = sizes[sizes.length - 1];
    sizes.push(size === prev ? (prev === 'wide' ? 'medium' : 'wide') : size);
  }
  return sizes;
}

/**
 * Zoom range for each shot size. Bands are at least MIN_ZOOM_STEP apart, so cutting from one size
 * to another always reads as a deliberate new shot. Without room for three sizes, "medium" is the
 * deepest band and "close" is never used.
 */
export function zoomBands(maxZoom: number): Record<ShotSize, [number, number]> {
  const deep: [number, number] = [maxZoom / MOVE_RANGE, maxZoom];
  if (!canUseClose(maxZoom)) return { wide: WIDE_BAND, medium: deep, close: deep };
  const centre = Math.sqrt(WIDE_BAND[1] * deep[0]);
  const half = Math.sqrt(MOVE_RANGE);
  return { wide: WIDE_BAND, medium: [centre / half, centre * half], close: deep };
}

/** Room for two sizes (wide + one deeper band). */
function canSplitShots(maxZoom: number): boolean {
  return maxZoom / MOVE_RANGE >= WIDE_BAND[1] * MIN_ZOOM_STEP;
}

/** Room for three sizes: wide, medium and close, each a clear step apart. */
function canUseClose(maxZoom: number): boolean {
  return maxZoom / MOVE_RANGE >= WIDE_BAND[1] * MIN_ZOOM_STEP * MOVE_RANGE * MIN_ZOOM_STEP - 1e-6;
}

function focusFor(size: ShotSize, focus: ImageFocus, useAlt: boolean): { x: number; y: number } {
  const target = useAlt && focus.alt ? focus.alt : focus;
  if (size === 'wide') return { x: 0.5, y: 0.5 };
  if (size === 'medium') return { x: (target.x + 0.5) / 2, y: (target.y + 0.5) / 2 };
  return { x: target.x, y: target.y };
}

// ─── Camera moves ──────────────────────────────────────────────────────────

const PREFERRED_FIRST_MOVE: Partial<Record<CameraMotionEffect, MoveType>> = {
  ZOOM_IN: 'push_in',
  ZOOM_OUT: 'pull_out',
  PAN_LEFT: 'drift',
  PAN_RIGHT: 'drift',
  STATIC: 'hold',
};

function pickMove(size: ShotSize, pace: CutPace, lastMove: MoveType | null, preferred: MoveType | undefined, random: () => number): MoveType {
  const options: MoveType[] =
    pace === 'ATMOSPHERIC_HOLD'
      ? ['drift', 'push_in', 'hold']
      : size === 'wide'
        ? ['pull_out', 'drift', 'push_in']
        : ['push_in', 'drift', 'pull_out'];
  if (preferred && preferred !== lastMove) return preferred;
  const allowed = options.filter((o) => o !== lastMove);
  return allowed[Math.floor(random() * allowed.length)];
}

/** Applies a move within the size's zoom band; drift slides across the focus, more for fast scenes. */
function moveFramings(
  band: [number, number],
  at: { x: number; y: number },
  move: MoveType,
  pace: CutPace,
  random: () => number,
  panDir: number
): { from: Framing; to: Framing } {
  const [lo, hi] = band;
  const mid = Math.sqrt(lo * hi);
  if (move === 'push_in') return { from: { zoom: lo, ...at }, to: { zoom: hi, ...at } };
  if (move === 'pull_out') return { from: { zoom: hi, ...at }, to: { zoom: lo, ...at } };
  if (move === 'hold') return { from: { zoom: mid, ...at }, to: { zoom: Math.min(hi, mid * 1.01), ...at } };
  // Drift at the band's deepest zoom, which leaves the most room to travel.
  const strength = pace === 'FAST_CUT' ? 1.4 : pace === 'ATMOSPHERIC_HOLD' ? 0.6 : 1;
  return driftAcross(at, hi, 0.06 * strength * panDir);
}

/**
 * One continuous move over a whole scene: a push-in travels from the full picture into its
 * subject, a pull-out the reverse, a drift slides across the subject. Longer scenes travel
 * further, at about the same slow speed, never deeper than the sharp limit.
 */
function oneTakeFramings(
  focus: ImageFocus,
  move: MoveType,
  durationSec: number,
  maxZoom: number,
  pace: CutPace,
  panDir: number
): { from: Framing; to: Framing } {
  const speed = pace === 'FAST_CUT' ? 1.3 : pace === 'ATMOSPHERIC_HOLD' ? 0.7 : 1;
  const travel = Math.min(maxZoom - 1, Math.max(0.06, (0.05 + 0.014 * durationSec) * speed), 0.3);
  // Head most of the way toward the subject, keeping a little of the original composition.
  const subject = { x: 0.5 + (focus.x - 0.5) * 0.8, y: 0.5 + (focus.y - 0.5) * 0.8 };
  const full: Framing = { zoom: 1, x: 0.5, y: 0.5 };
  const into: Framing = { zoom: 1 + travel, ...subject };
  if (move === 'push_in') return { from: full, to: into };
  if (move === 'pull_out') return { from: into, to: full };
  // A slow, quiet push that stays near the whole picture (for calm, moody scenes).
  if (move === 'hold') return { from: { zoom: 1.03, ...subject }, to: { zoom: 1.03 + travel * 0.6, ...subject } };
  const zoom = Math.min(maxZoom, 1.1 + travel / 3);
  return driftAcross(subject, zoom, Math.min(0.1, 0.03 + 0.004 * durationSec) * speed * panDir);
}

/**
 * A sideways slide at a fixed zoom, centred as close to the subject as the frame allows. The
 * view can't leave the image, so a path centred on a subject near the edge is moved inward
 * (otherwise both ends clamp to the same spot and the camera doesn't move at all).
 */
function driftAcross(at: { x: number; y: number }, zoom: number, pan: number): { from: Framing; to: Framing } {
  const half = 0.5 / zoom; // half the visible width, in image units
  const room = 1 - 2 * half; // how far the view centre can travel
  const travel = Math.sign(pan) * Math.min(Math.abs(pan), room * 0.9);
  const lo = half + Math.abs(travel) / 2;
  const x = Math.min(1 - lo, Math.max(lo, at.x));
  const y = Math.min(1 - half, Math.max(half, at.y));
  return { from: { zoom, x: x - travel / 2, y }, to: { zoom, x: x + travel / 2, y } };
}

// ─── Transitions between scenes ────────────────────────────────────────────

function sceneTransition(
  mode: TransitionType | 'auto',
  prev: PlannerScene,
  next: PlannerScene,
  crossfadeSec: number,
  lastStylised: { value: ShotTransition | null }
): { type: ShotTransition; sec: number } {
  if (mode === 'cut' || mode === 'none') return { type: 'cut', sec: 0 };
  if (mode === 'crossfade') return { type: 'crossfade', sec: crossfadeSec };
  if (mode === 'fade_black' || mode === 'fade_to_black') return { type: 'dip', sec: Math.max(0.5, crossfadeSec) };
  if (mode === 'slide_left') return { type: 'whip', sec: 0.3 };
  // Director's mix: dissolve into or out of slow, moody scenes; energetic stylised cuts into fast
  // ones (alternating, never the same twice running); a plain cut everywhere else.
  if (prev.cutPace === 'ATMOSPHERIC_HOLD' || next.cutPace === 'ATMOSPHERIC_HOLD') return { type: 'crossfade', sec: Math.max(0.7, crossfadeSec) };
  if (next.cutPace === 'FAST_CUT') {
    const type: ShotTransition = lastStylised.value === 'zoom_through' ? 'whip' : 'zoom_through';
    lastStylised.value = type;
    return { type, sec: type === 'whip' ? 0.3 : 0.35 };
  }
  return { type: 'cut', sec: 0 };
}

// ─── Plan ──────────────────────────────────────────────────────────────────

export function planShots(scenes: PlannerScene[], options: PlanOptions): Shot[] {
  const sorted = [...scenes].sort((a, b) => (a.audioStartSec ?? 0) - (b.audioStartSec ?? 0) || a.sceneId - b.sceneId);
  if (sorted.length === 0) return [];
  const maxZoom = Math.max(WIDE_BAND[1], options.maxZoom);
  // Without room for two clearly different framings, keep one shot per scene.
  const canSplit = canSplitShots(maxZoom);
  const allowClose = canUseClose(maxZoom);
  const bands = zoomBands(maxZoom);
  const crossfadeSec = options.crossfadeSec ?? 0.6;
  const shots: Shot[] = [];
  let lastMove: MoveType | null = null;
  const lastStylised = { value: null as ShotTransition | null };

  sorted.forEach((scene, i) => {
    // Shots cover the timeline without gaps: from this scene's start to the next one's.
    const start = i === 0 ? 0 : Math.max(shots[shots.length - 1]?.end ?? 0, scene.audioStartSec ?? 0);
    const end = i === sorted.length - 1 ? Math.max(start + 0.1, options.totalDurationSec) : Math.max(start + 0.1, sorted[i + 1].audioStartSec ?? start + 0.1);
    const pace = scene.cutPace ?? 'NORMAL';
    const { target, min } = PACE[pace];
    const random = rng(scene.sceneId);

    const oneTake = (options.anglesPerImage ?? 'one') === 'one';
    const wanted = canSplit && !oneTake ? Math.max(1, Math.min(MAX_SHOTS_PER_SCENE, Math.round((end - start) / target))) : 1;
    const cuts = cutTimes(cutCandidates(scene, start, end, options.words), start, end, wanted, min);
    const bounds = [start, ...cuts, end];
    const sizes = sizesFor(bounds.length - 1, scene.shotType, allowClose);
    const focus = options.focus?.get(scene.sceneId) ?? { x: 0.5, y: 0.5 };
    const panDir = random() < 0.5 ? -1 : 1;
    let closeCount = 0;

    for (let k = 0; k < bounds.length - 1; k++) {
      const size = sizes[k];
      const preferred = k === 0 && scene.cameraMotion ? PREFERRED_FIRST_MOVE[scene.cameraMotion] : undefined;
      const move = pickMove(size, pace, lastMove, preferred, random);
      const at = focusFor(size, focus, size === 'close' && closeCount++ > 0);
      const { from, to } = oneTake
        ? oneTakeFramings(focus, move, end - start, maxZoom, pace, panDir)
        : moveFramings(bands[size], at, move, pace, random, k % 2 === 0 ? panDir : -panDir);

      let transition: { type: ShotTransition; sec: number } = { type: 'cut', sec: 0 };
      if (k === 0 && i > 0) transition = sceneTransition(options.transitionType, sorted[i - 1], scene, crossfadeSec, lastStylised);
      // A transition can't be longer than half of either shot it joins.
      const prevShot = shots[shots.length - 1];
      const room = Math.min(bounds[k + 1] - bounds[k], prevShot ? prevShot.end - prevShot.start : Infinity) / 2;

      shots.push({
        sceneId: scene.sceneId,
        start: bounds[k],
        end: bounds[k + 1],
        size,
        move,
        from,
        to,
        transitionIn: transition.sec > 0 && room > 0.05 ? transition.type : 'cut',
        transitionSec: transition.sec > 0 ? Math.min(transition.sec, room) : 0,
      });
      lastMove = move;
    }
  });
  return shots;
}

/** Index of the shot on screen at time `t` (shots are contiguous and sorted). */
export function shotIndexAt(shots: Shot[], t: number): number {
  let lo = 0;
  let hi = shots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (shots[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Deepest zoom that still looks acceptably sharp: about 1.6× when a 576-px-tall image fills a
 * 1080p frame, deeper at 720p, shallow at 4K.
 */
export function maxZoomFor(imageShortSide: number, outputShortSide: number): number {
  const z = 1.6 * (imageShortSide / 576) * (1080 / outputShortSide);
  return Math.min(2.2, Math.max(1.1, z));
}
