/**
 * Checks a storyboard before any prompt is written. First the conflicts that have one safe
 * fix are fixed (an end frame showing the opposite state, a reference to an image that doesn't
 * exist); then everything else is reported: blocking problems are sent back to the AI once,
 * what remains is shown to the creator.
 */
import { analyzeShot, cameraConflict, COMPLEXITY_LIMIT, isDeadShot } from './complexity';
import { fitGeneration, MODELS, type FlowMode } from './models';
import { DEFAULT_PACE, PACES, rawSeconds, type Pace } from './pacing';
import { CAPTION_MAX_WORDS, MAX_HASHTAGS, MAX_SECONDS, MAX_WORDS_PER_SECOND, MIN_SECONDS, TITLE_MAX, type Issue, type Shot, type Storyboard } from './types';

const WORKING_NAME = /\bpart\s*\d+\b/i;
const SPEED_CLAIM = /\bin\s+(?:just\s+)?(?:\d+\s+|a\s+few\s+)?(?:seconds?|secs?|minutes?|mins?)\b/i;
const SCENE_CHANGE = /\b(cuts? (?:back )?to|then cut|transition(?:s)? to|split[- ]screen|meanwhile|scene changes?)\b/i;
const STILL_START = /\b(static scene|still frame|no movement|motionless|hover(?:s|ing)?|about to|ready to|waits?|pauses?)\b/i;
const COLORS = ['beige', 'black', 'white', 'grey', 'gray', 'red', 'blue', 'green', 'brown', 'tan', 'cream', 'yellow', 'silver', 'orange', 'pink', 'purple'];

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** What is wrong with a title, if anything (also used for the packaging options). */
export function titleProblems(title: string): string[] {
  const out: string[] = [];
  if (title.length > TITLE_MAX) out.push(`longer than ${TITLE_MAX} characters`);
  if (/#\S/.test(title)) out.push('has a hashtag');
  if (WORKING_NAME.test(title)) out.push('reads like a working name ("Part 2")');
  if (SPEED_CLAIM.test(title)) out.push('promises a time ("in seconds") the video can’t prove');
  return out;
}
const norm = (s: string | null) => (s ?? '').trim().toLowerCase();
export const totalSeconds = (sb: Storyboard) => sb.shots.reduce((n, s) => n + s.seconds, 0);
export const voiceWords = (sb: Storyboard) => sb.audio.voiceover.reduce((n, v) => n + words(v.text), 0);
export const maxVoiceWords = (seconds: number) => Math.floor(seconds * MAX_WORDS_PER_SECOND);
export const shotStarts = (sb: Storyboard) => sb.shots.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + sb.shots[i - 1].seconds], []);

/**
 * Safe fixes, made without asking: whole hashtags, no hashtags in the title, references and
 * frames only to images that exist, start/end frames only where the image shows the shot's own
 * state, end frames only where the model takes one, continuity only to an earlier shot.
 */
export function resolve(sb: Storyboard, mode: FlowMode): { storyboard: Storyboard; fixes: string[] } {
  const fixes: string[] = [];
  const model = MODELS[mode];
  const assets = new Map(sb.assets.map((a) => [a.id, a]));
  const shots = sb.shots.map((shot, i): Shot => {
    const n = i + 1;
    let { startFrame, endFrame, continuity } = shot;
    const references = shot.references.filter((r) => {
      if (assets.has(r.asset)) return true;
      fixes.push(`Shot ${n}: removed a reference to image ${r.asset}, which isn’t in the list.`);
      return false;
    });
    const frameState = (id: string | null) => (id ? (assets.get(id)?.state ?? null) : null);
    if (startFrame && !assets.has(startFrame)) {
      fixes.push(`Shot ${n}: removed start frame ${startFrame}, which isn’t in the list.`);
      startFrame = null;
    } else if (startFrame && frameState(startFrame) && shot.stateBefore && norm(frameState(startFrame)) !== norm(shot.stateBefore)) {
      fixes.push(`Shot ${n}: removed start frame ${startFrame}: it shows "${frameState(startFrame)}", but the shot starts "${shot.stateBefore}".`);
      startFrame = null;
    }
    if (endFrame && !assets.has(endFrame)) {
      fixes.push(`Shot ${n}: removed end frame ${endFrame}, which isn’t in the list.`);
      endFrame = null;
    } else if (endFrame && frameState(endFrame) && shot.stateAfter && norm(frameState(endFrame)) !== norm(shot.stateAfter)) {
      fixes.push(`Shot ${n}: removed end frame ${endFrame}: it shows "${frameState(endFrame)}", but the shot ends "${shot.stateAfter}".`);
      endFrame = null;
    } else if (endFrame && model.lastFrame !== true) {
      fixes.push(`Shot ${n}: removed the end frame: ${model.label} ${model.lastFrame === 'unknown' ? 'may not take' : 'doesn’t take'} one.`);
      endFrame = null;
    }
    if (endFrame && endFrame === startFrame) {
      fixes.push(`Shot ${n}: removed the end frame: it was the same image as the start, so nothing could change.`);
      endFrame = null;
    }
    if (continuity.with !== null && (continuity.with >= n || continuity.with < 1)) {
      fixes.push(`Shot ${n}: removed continuity with shot ${continuity.with}, which doesn’t come before it.`);
      continuity = { ...continuity, with: null, kind: 'none' };
    }
    return { ...shot, references, startFrame, endFrame, continuity };
  });
  const tags = Array.from(new Set(sb.packaging.hashtags.map((h) => `#${h.replace(/^#+/, '').replace(/\s+/g, '')}`))).slice(0, MAX_HASHTAGS);
  let title = sb.packaging.title.replace(/\s*#\S+/g, '').trim() || sb.packaging.title;
  const noClaim = title
    .replace(SPEED_CLAIM, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s:,–-]+$/, '')
    .trim();
  if (noClaim !== title && noClaim.split(/\s+/).length >= 2) {
    fixes.push(`Title: removed a time it can’t prove ("${title}" → "${noClaim}").`);
    title = noClaim;
  }
  return { storyboard: { ...sb, shots, packaging: { ...sb.packaging, title, hashtags: tags } }, fixes };
}

export function validateStoryboard(sb: Storyboard, mode: FlowMode, dropWallSec: number | null = null, pace: Pace = DEFAULT_PACE): Issue[] {
  const rule = PACES[pace];
  const issues: Issue[] = [];
  const add = (shot: number | null, level: Issue['level'], message: string) => issues.push({ shot, level, message });
  const model = MODELS[mode];
  const assets = new Map(sb.assets.map((a) => [a.id, a]));
  const seconds = totalSeconds(sb);
  const starts = shotStarts(sb);

  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) add(null, 'block', `The shots add up to ${seconds}s; a Short here is ${MIN_SECONDS}–${MAX_SECONDS}s.`);
  const [minShots, maxShots] = rule.shots;
  if (sb.shots.length < 3) add(null, 'block', `Use at least 3 shots; this has ${sb.shots.length}.`);
  else if (sb.shots.length < minShots || sb.shots.length > maxShots)
    add(null, 'warn', `A ${rule.label.toLowerCase()} Short usually has ${minShots}–${maxShots} shots; this has ${sb.shots.length}.`);

  for (const a of sb.assets) {
    if (SCENE_CHANGE.test(a.description)) add(null, 'block', `IMAGE ${a.id} is a split screen or montage: a reference must show one real object in one state.`);
    if (a.editOf && !assets.has(a.editOf)) add(null, 'warn', `IMAGE ${a.id} is an edit of IMAGE ${a.editOf}, which isn’t in the list.`);
  }

  sb.shots.forEach((shot, i) => {
    const n = i + 1;
    const c = analyzeShot(shot);
    if (c.score > COMPLEXITY_LIMIT) add(n, 'block', `Too much for one generation (${c.reasons.join('; ')}). ${c.fixes.join(' ')}`.trim());
    else if (c.actions > 1) add(n, 'block', `${c.actions} separate actions: one shot, one action. Split it.`);
    if (isDeadShot(shot)) add(n, 'warn', 'Nothing moves or changes in this shot: give it one visible motion (a slow push-in, light moving, a brush stroke) or cut it.');
    const cam = cameraConflict(shot);
    if (cam) add(n, 'block', cam);
    if (SCENE_CHANGE.test(`${shot.subject} ${shot.action} ${shot.composition}`)) add(n, 'block', 'A scene change or split screen inside one shot: make it a separate shot.');
    if (shot.seconds > rule.maxShot)
      add(n, 'block', `${shot.seconds}s on screen is too slow for a ${rule.label.toLowerCase()} Short (at most ${rule.maxShot}s): split it, or speed it up 2× in editing.`);
    if (!fitGeneration(rawSeconds(shot), model, shot.references.length > 0))
      add(n, 'block', `${model.label} can’t make a ${rawSeconds(shot)}s clip${shot.references.length ? ' with reference images' : ''}.`);
    if (shot.endFrame && shot.startFrame && shot.stateBefore && shot.stateAfter && norm(shot.stateBefore) !== norm(shot.stateAfter)) {
      const s = assets.get(shot.startFrame);
      const e = assets.get(shot.endFrame);
      if (s?.state && e?.state && norm(s.state) === norm(e.state))
        add(n, 'block', `Start and end frames both show "${s.state}", but the shot changes "${shot.stateBefore}" → "${shot.stateAfter}".`);
    }
    if (shot.continuity.kind === 'exact_frame' && shot.continuity.with) {
      const prev = sb.shots[shot.continuity.with - 1];
      if (prev && norm(prev.camera.position) !== norm(shot.camera.position)) {
        add(n, 'warn', `Exact-frame continuity with shot ${shot.continuity.with}, but from a different camera position. Use "visual" continuity, or keep the same angle.`);
      }
    }
    if (shot.continuity.with) {
      const prev = sb.shots[shot.continuity.with - 1];
      if (prev?.stateAfter && shot.stateBefore && norm(prev.stateAfter) !== norm(shot.stateBefore)) {
        add(n, 'warn', `Shot ${shot.continuity.with} ends "${prev.stateAfter}", but this shot starts "${shot.stateBefore}".`);
      }
    }
    // The same object in a different color than its reference image.
    for (const ref of shot.references) {
      const desc = assets.get(ref.asset)?.description.toLowerCase() ?? '';
      const refColors = COLORS.filter((c) => new RegExp(`\\b${c}\\b`).test(desc));
      const shotColors = COLORS.filter((c) => new RegExp(`\\b${c}\\b`).test(shot.subject.toLowerCase()));
      const clash = shotColors.filter((c) => refColors.length > 0 && !refColors.includes(c));
      if (clash.length) add(n, 'warn', `Says "${clash.join(', ')}" but reference ${ref.asset} is ${refColors.join(', ')}.`);
    }
  });

  // A change of state needs state images, or the object may not stay the same.
  const changes = sb.shots.some((x) => x.stateBefore && x.stateAfter && norm(x.stateBefore) !== norm(x.stateAfter));
  if (changes && !sb.assets.some((a) => a.kind === 'state'))
    add(null, 'warn', 'The object changes state but there are no state images: add one per state (edits of the base image) so it stays the same object.');

  // The hook: short, already moving.
  const hook = sb.shots[0];
  if (hook) {
    if (hook.seconds > rule.hookMax) add(1, 'block', `The hook shot is ${hook.seconds}s; at a ${rule.label.toLowerCase()} pace keep it to ${rule.hookMax}s.`);
    if (hook.speed === 'slow_motion') add(1, 'block', 'The hook is in slow motion: open fast, save slow motion for the payoff.');
    if (STILL_START.test(hook.action)) add(1, 'block', 'The hook is still or waiting: the action must already be happening at 0s.');
  }

  // Audio, kept apart from the pictures.
  const wall = dropWallSec ?? 5;
  for (const v of sb.audio.voiceover) {
    if (v.shot > sb.shots.length) {
      add(null, 'warn', `A voiceover line is set on shot ${v.shot}, which doesn’t exist.`);
      continue;
    }
    const from = starts[v.shot - 1];
    const to = from + sb.shots[v.shot - 1].seconds;
    if (from < wall + 1 && to > wall - 1) add(v.shot, 'warn', `Voiceover around ${wall}s: viewers leave there, so show, don’t talk.`);
  }
  const spoken = voiceWords(sb);
  if (spoken > maxVoiceWords(seconds)) add(null, 'block', `Too many spoken words: ${spoken}, at most ${maxVoiceWords(seconds)} for ${seconds}s.`);

  for (const c of sb.captions) if (words(c.text) > CAPTION_MAX_WORDS) add(c.shot, 'warn', `On-screen text "${c.text}" has more than ${CAPTION_MAX_WORDS} words.`);
  const p = sb.packaging;
  if (p.title.length > TITLE_MAX) add(null, 'warn', `The title is longer than ${TITLE_MAX} characters.`);
  if (WORKING_NAME.test(p.title)) add(null, 'block', 'The title reads like a working name ("Part 2"): say what the viewer sees instead.');
  if (SPEED_CLAIM.test(p.title)) add(null, 'block', 'The title promises a time ("in seconds") the video can’t prove: drop it.');
  if (p.coverShot > sb.shots.length) add(null, 'warn', 'The cover shot doesn’t exist.');
  return issues;
}
