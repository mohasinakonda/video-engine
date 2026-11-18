/**
 * How hard a shot is for a video model, without AI: moving subjects, separate actions, hands
 * using tools or liquids, a camera that moves during that, exact continuity, and physics that
 * models get wrong. A high score means split or simplify the shot, not write fewer words.
 */
import type { Shot } from './types';

/** Above this a shot must be split or simplified before it is generated. */
export const COMPLEXITY_LIMIT = 60;

const HANDS = /\b(hands?|gloved?|fingers?|holds?|holding|grips?|picks? up|places?|sets? down|sprays?|wipes?|wiping|brush(?:es|ing)?|press(?:es|ing)?|pours?|scrubs?|lifts?)\b/i;
const PHYSICS = /\b(liquid|water|foam|suction|suck(?:s|ed|ing)?|splash(?:es|ing)?|spray(?:s|ing)?|mist|drips?|pour(?:s|ing)?|steam|bubbles?|flows?|soak(?:s|ing)?|reflections?)\b/i;
const MOVING_CAMERA_WORDS = /\b(pulls? back|push(?:es)? in|zooms?|dolly|pans?|tilts?|orbits?|tracks?|tracking|circles? around|crane)\b/i;

/**
 * Kinds of physical action. Words in one group are the same action told differently ("slides",
 * "passes", "is pulled"), so a shot that uses two of them still does one thing.
 */
const ACTION_GROUPS: Record<string, string[]> = {
  move: ['move', 'slide', 'pass', 'glide', 'sweep', 'drag', 'pull', 'push', 'spin', 'roll', 'travel'],
  spray: ['spray', 'mist', 'squirt'],
  wipe: ['wipe', 'dab', 'polish', 'buff'],
  brush: ['brush', 'scrub', 'agitate'],
  pick: ['pick', 'grab', 'lift', 'raise'],
  place: ['place', 'set', 'put', 'drop', 'lower'],
  pour: ['pour', 'dip', 'squeeze', 'fill', 'empty'],
  open: ['open', 'close', 'unscrew', 'unplug'],
  rinse: ['rinse', 'wash', 'dry', 'hose'],
  extract: ['vacuum', 'suck', 'extract'],
  leave: ['leave', 'exit', 'enter'],
  apply: ['apply', 'remove', 'peel', 'stick'],
  press: ['press', 'tap', 'turn', 'rotate', 'switch', 'flip'],
  shake: ['shake', 'tilt', 'swirl'],
};
const GROUP_OF = new Map(Object.entries(ACTION_GROUPS).flatMap(([group, verbs]) => verbs.map((v) => [v, group] as const)));

/** The group of a finite verb form ("sprays", "brushes", "is pulled"), if it is an action word. */
function groupOf(word: string, passive: boolean): string | undefined {
  const w = word.toLowerCase();
  const stems = passive ? [w.slice(0, -2), w.slice(0, -1), w.slice(0, -3)] : [w.slice(0, -1), w.slice(0, -2)];
  for (const stem of stems) {
    const g = GROUP_OF.get(stem);
    if (g) return g;
  }
  return undefined;
}

/**
 * Separate physical actions in a shot: kinds of action said with a present-tense verb ("sprays",
 * "picks up", "is pulled"). Participles (", leaving a clean stripe") describe the result, and
 * commas between adjectives ("a clean, wet stripe") don't start a new action.
 */
export function countActions(action: string): number {
  const groups = new Set<string>();
  for (const m of Array.from(action.matchAll(/\b(?:is|are|gets|get)\s+(\w+ed)\b/gi))) {
    const g = groupOf(m[1], true);
    if (g) groups.add(g);
  }
  for (const m of Array.from(action.matchAll(/\b(\w+?(?:es|s))\b/gi))) {
    const g = groupOf(m[1], false);
    if (g) groups.add(g);
  }
  const sequence = /\b(then|after that|afterwards|followed by)\b/i.test(action) ? 2 : 1;
  return Math.max(groups.size, sequence);
}

/** Independently moving subjects: "a hand and a nozzle" is two. */
export function countSubjects(subject: string): number {
  return Math.max(1, subject.split(/,|\band\b|\bwith\b|\bplus\b/i).filter((p) => p.trim().split(/\s+/).length >= 1 && p.trim()).length);
}

export interface Complexity {
  score: number;
  actions: number;
  subjects: number;
  hands: boolean;
  physics: boolean;
  movingCamera: boolean;
  reasons: string[];
  /** What to do about it, when the score is over the limit. */
  fixes: string[];
}

export function analyzeShot(shot: Shot): Complexity {
  const text = `${shot.subject}. ${shot.action}`;
  const actions = countActions(shot.action);
  const subjects = countSubjects(shot.subject);
  const hands = HANDS.test(text);
  const physics = PHYSICS.test(text);
  const movingCamera = shot.camera.movement !== 'none';
  const exact = shot.continuity.kind === 'exact_frame';

  const reasons: string[] = [];
  const fixes: string[] = [];
  let score = 10;
  if (actions > 1) {
    score += 25 * (actions - 1);
    reasons.push(`${actions} separate actions in one shot`);
    fixes.push('Split it so each shot has one action.');
  }
  if (subjects > 2) {
    score += 15 * (subjects - 2);
    reasons.push(`${subjects} moving subjects`);
    fixes.push('Keep one main subject; move the others out of the shot.');
  }
  if (hands) {
    score += 10;
    reasons.push('hands using a tool or surface');
  }
  if (physics) {
    score += 15;
    reasons.push('liquid, suction or reflections (models often get these wrong)');
  }
  if (movingCamera && (hands || physics)) {
    score += 20;
    reasons.push('the camera moves during a hand or liquid action');
    fixes.push('Lock the camera for this shot, or move the camera in a separate shot.');
  }
  if (exact && movingCamera) {
    score += 10;
    reasons.push('exact frame continuity with a moving camera');
  }
  if (shot.seconds > 6 && (hands || physics)) {
    score += 10;
    reasons.push(`${shot.seconds}s of continuous hand or liquid action`);
    fixes.push('Shorten it, or split it into two shots.');
  }
  return { score: Math.min(100, score), actions, subjects, hands, physics, movingCamera, reasons, fixes };
}

/** A shot where nothing moves or changes: viewers swipe on dead frames. */
export const isDeadShot = (shot: Shot) => shot.camera.movement === 'none' && /\b(static shot|still shot|no movement|nothing (?:moves|happens)|holds? on)\b/i.test(shot.action);

/** True when the camera text and the chosen movement disagree. */
export function cameraConflict(shot: Shot): string | null {
  const said = `${shot.camera.position} ${shot.action}`;
  if (shot.camera.movement === 'none' && MOVING_CAMERA_WORDS.test(said)) return 'The camera is static, but the shot describes a camera move.';
  if (shot.camera.movement !== 'none' && /\b(static|locked(?:[- ]off)?|tripod|still camera|fixed camera)\b/i.test(shot.camera.position)) {
    return `The camera position says it is locked, but the movement is "${shot.camera.movement.replace('_', ' ')}".`;
  }
  return null;
}
