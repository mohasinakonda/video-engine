/**
 * What the creator pastes into Google Flow, built from the storyboard without AI: standing rules
 * for the project's Agent Instructions, the reference images to make first, and one prompt per
 * shot (one generation each) in a fixed field order. Sound and editing are listed separately.
 */
import { fitGeneration, MODELS, type FlowMode } from './models';
import { DEFAULT_PACE, PACES, rawSeconds, SPEEDS, speedEdit, type Pace } from './pacing';
import type { Asset, FlowStyle, Insights, NextShort, Shot, Storyboard } from './types';
import { shotStarts } from './validate';

const clean = (v: string) => v.trim().replace(/\.+$/, '');
const sec = (s: number) => `0:${String(s).padStart(2, '0')}`;

const MOVE: Record<Shot['camera']['movement'], string> = {
  none: 'Static camera, no movement.',
  push_in: 'Slow, steady push-in toward the subject.',
  pull_back: 'Slow, steady pull-back from the subject.',
  pan: 'Slow pan following the action.',
  tilt: 'Slow tilt following the action.',
  track: 'The camera tracks alongside the subject at the same speed.',
  orbit: 'Slow partial orbit around the subject.',
};

/** Flow settings and steps for the chosen model. */
export function setupSteps(mode: FlowMode): string[] {
  const model = MODELS[mode];
  return [
    'Use one Flow project per channel: the Agent remembers its chats only inside that project.',
    'Paste the rules into the project’s Agent Instructions (the button under the prompt box), not into the chat.',
    'Set the orientation to vertical in the generation settings: writing 9:16 in a prompt doesn’t change it.',
    'Make the reference images first. Bring a real photo of your product where the list asks for one.',
    `Model: ${model.label}. Generate one shot at a time, check it, and redo only the shots that fail.`,
    ...model.notes,
    'Join the shots in Scenebuilder, trim each to its length, then add the voiceover, sound and text in editing.',
  ];
}

export function flowInstruction(channelTitle: string, style: FlowStyle, insights: Insights, mode: FlowMode, pace: Pace = DEFAULT_PACE): string {
  const rule = PACES[pace];
  // Lines that quote an old title are left out: they carry brand names Flow could draw.
  const facts = insights.lines
    .filter((l) => !l.includes('"'))
    .slice(0, 5)
    .map((l) => `- ${l}`)
    .join('\n');
  return `Project: YouTube Shorts for "${channelTitle}". Audience: ${clean(style.audience)}.
${facts ? `\nWhat this channel's numbers show:\n${facts}\n` : ''}
How I work:
- Each Short is a storyboard of separate shots. Every SHOT is its own generation with ${MODELS[mode].label}; I join them in Scenebuilder.
- First I send the IMAGES (references, start frames). Make them before any video and keep them unchanged.
- When a shot names an image as start frame, start exactly on it. When it names a reference, keep the listed details of that object identical.
- Generate right away when I send images or shots: don't ask me to confirm, don't stop to list a plan, and don't wait between items. If something is unclear, make the simplest choice that follows these rules and keep going.

Rules for every shot:
- One subject, one action, one camera position, at most one camera move. Nothing else happens.
- Pace: ${rule.label.toLowerCase()}. Shorts are fast: brisk, decisive motion that finishes within the clip; no slow drifting, no lingering at the start or end. Slow motion only where a shot asks for it.
- The first shot is already in motion at its first frame. No intro, fade-in, black frame, logo or title card.
- Look (same in every shot): ${clean(style.look)}.
- If I give a product photo, keep its exact shape, colors, buttons and nozzle; don't add or change branding. Without one, products are plain with blank labels.
- No text, captions or words in the video. No music. Speak only lines I write in quotes.`;
}

/** Main images first, then each edit after the image it is made from, then the creator's own photos. */
export function orderedAssets(sb: Storyboard): Asset[] {
  const made = sb.assets.filter((a) => !a.fromCreator);
  const ids = new Set(made.map((a) => a.id));
  const out: Asset[] = [];
  const add = (a: Asset) => {
    if (out.includes(a)) return;
    const parent = a.editOf && ids.has(a.editOf) ? made.find((x) => x.id === a.editOf) : undefined;
    if (parent && !out.includes(parent) && parent !== a) add(parent);
    out.push(a);
  };
  made.filter((a) => !a.editOf || !ids.has(a.editOf)).forEach(add);
  made.forEach(add);
  return [...out, ...sb.assets.filter((a) => a.fromCreator)];
}

export function assetPrompt(asset: Asset, main: string | null): string {
  if (asset.fromCreator) return `IMAGE ${asset.id} (I will upload my own photo): ${clean(asset.description)}.`;
  const label = asset.editOf ? `edit of IMAGE ${asset.editOf}` : asset.id === main ? 'main image' : 'new image';
  return `IMAGE ${asset.id} (${label}): ${clean(asset.description)}.`;
}

/** All reference images in one paste: the main image first, then every image made from it. */
export function imagesPrompt(sb: Storyboard): string {
  const assets = orderedAssets(sb);
  if (assets.length === 0) return '';
  const main = assets.find((a) => !a.fromCreator && !a.editOf)?.id ?? null;
  const edits = assets.some((a) => a.editOf);
  const intro = [
    'Make these reference images for one Short, in this order. Vertical 9:16, photorealistic, no text or logos.',
    main ? `Make IMAGE ${main} first: it is the main image.` : null,
    edits
      ? 'Make each image marked "edit of" by editing that image (use it as the reference): change only what is written, and keep the same object, angle, framing, light and background.'
      : null,
    'Name the images as written (A1, A2…): the shots use these names.',
  ]
    .filter(Boolean)
    .join(' ');
  return [intro, '', ...assets.map((a) => assetPrompt(a, main))].join('\n');
}

export function shotPrompt(sb: Storyboard, i: number, mode: FlowMode): string {
  const shot = sb.shots[i];
  const n = i + 1;
  const model = MODELS[mode];
  const assets = new Map(sb.assets.map((a) => [a.id, a]));
  const raw = rawSeconds(shot);
  const fit = fitGeneration(raw, model, shot.references.length > 0);
  const length = fit ? `generate ${fit.seconds}s${fit.trim ? `, use ${raw}s` : ''}` : `${raw}s`;
  const lines = [`SHOT ${n} of ${sb.shots.length}: ${clean(shot.title)} (${length})`];
  if (shot.startFrame) lines.push(`Start frame: IMAGE ${shot.startFrame}${assets.get(shot.startFrame)?.state ? ` (${assets.get(shot.startFrame)!.state})` : ''}.`);
  if (shot.endFrame) lines.push(`End frame: IMAGE ${shot.endFrame}${assets.get(shot.endFrame)?.state ? ` (${assets.get(shot.endFrame)!.state})` : ''}.`);
  lines.push(`SUBJECT: ${clean(shot.subject)}.`);
  lines.push(`ACTION: ${clean(shot.action)}.`);
  lines.push(`ENVIRONMENT: ${clean(shot.environment)}.`);
  if (shot.references.length) {
    lines.push(`REFERENCE IDENTITY: ${shot.references.map((r) => `IMAGE ${r.asset}: keep ${r.preserve.map(clean).join(', ')} exactly the same`).join('; ')}.`);
  }
  lines.push(`CAMERA POSITION: ${clean(shot.camera.position)}.`);
  lines.push(`CAMERA MOVEMENT: ${MOVE[shot.camera.movement]}`);
  lines.push(`LIGHTING: ${clean(shot.lighting)}.`);
  lines.push(`COMPOSITION: ${clean(shot.composition)}.`);
  lines.push(
    `MOTION AND TIMING: One continuous action over ${raw} seconds. ${SPEEDS[shot.speed ?? 'real_time'].prompt} ${shot.stateBefore && shot.stateAfter && shot.stateBefore !== shot.stateAfter ? `It starts ${clean(shot.stateBefore)} and ends ${clean(shot.stateAfter)}.` : 'Nothing else changes.'}`,
  );
  if (shot.continuity.kind !== 'none' && shot.continuity.with) {
    const kind = { exact_frame: 'continues exactly from the last frame of', visual: 'looks the same as', temporal: 'happens right after', none: '' }[shot.continuity.kind];
    lines.push(`CONTINUITY: This shot ${kind} SHOT ${shot.continuity.with}${shot.continuity.keep.length ? `; keep ${shot.continuity.keep.map(clean).join(', ')} the same` : ''}.`);
  }
  if (shot.ambient && model.audio !== false) lines.push(`AUDIO: Ambient: ${clean(shot.ambient)}. No music, no speech.`);
  return lines.join('\n');
}

/** All shots in one paste: a short instruction, then SHOT 1, SHOT 2… */
export function shotsPrompt(sb: Storyboard, mode: FlowMode): string {
  const intro = [
    `Make these ${sb.shots.length} shots for one Short with ${MODELS[mode].label}. Each SHOT is a separate video; I join them in order.`,
    sb.assets.length ? 'Use the images named in each shot (A1, A2…, made before) as its start frame or reference, exactly as written.' : null,
    'Follow each shot exactly: one action, the camera as written, nothing else happens. Generate all shots now, one after another, without asking me to confirm.',
  ]
    .filter(Boolean)
    .join(' ');
  return [intro, ...sb.shots.map((_, i) => shotPrompt(sb, i, mode))].join('\n\n');
}

/** Everything one Short needs in Flow: the images, then the shots. */
export function shortPrompt(short: NextShort, index: number, mode: FlowMode): string {
  const sb = short.storyboard;
  const images = imagesPrompt(sb);
  return [`SHORT ${index + 1}: ${short.name}. ${short.seconds} seconds, ${sb.shots.length} shots.`, ...(images ? [images] : []), shotsPrompt(sb, mode)].join('\n\n');
}

export function audioPlanText(sb: Storyboard): string {
  const starts = shotStarts(sb);
  const at = (shot: number) => (shot <= sb.shots.length ? sec(starts[shot - 1]) : '?');
  const lines = [
    ...sb.audio.voiceover.map((v) => `${at(v.shot)} (shot ${v.shot}) Voiceover: "${v.text}"`),
    ...sb.audio.sfx.map((s) => `${at(s.shot)} (shot ${s.shot}) SFX: ${clean(s.sound)}`),
  ].sort();
  if (sb.audio.ambient) lines.push(`Ambient, whole Short: ${clean(sb.audio.ambient)}`);
  lines.push(sb.audio.music ? `Music: ${clean(sb.audio.music)}` : 'Music: none');
  return lines.join('\n');
}

export function postProduction(sb: Storyboard, mode: FlowMode, pace: Pace = DEFAULT_PACE): string[] {
  const rule = PACES[pace];
  const starts = shotStarts(sb);
  const model = MODELS[mode];
  const order = sb.shots.map((s, i) => {
    const raw = rawSeconds(s);
    const fit = fitGeneration(raw, model, s.references.length > 0);
    const steps = [fit && fit.trim ? `trim ${fit.trim}s from the ${fit.seconds}s clip` : null, speedEdit(s)].filter(Boolean);
    return `Shot ${i + 1} at ${sec(starts[i])}: ${s.seconds}s${steps.length ? ` (${steps.join(', then ')})` : ''}`;
  });
  const captions = sb.captions.map((c) => `"${c.text}" on shot ${c.shot}`);
  return [
    `Scenebuilder order: ${order.join(' · ')}.`,
    `Pace: ${rule.label.toLowerCase()}, no shot longer than ${rule.maxShot}s on screen. Cut straight from shot to shot on the action (no fades); the first frame must already move.`,
    'If a shot drags when you watch it back, trim it or speed it up. Never slow the first 3 seconds.',
    `Ending: ${clean(sb.brief.ending)}.`,
    ...(captions.length ? [`On-screen text: ${captions.join(' · ')}.`] : []),
    'Add the voiceover and sound from the audio plan; keep anything Flow made only if it fits.',
    'When you upload, turn on YouTube’s “altered or synthetic content” label.',
  ];
}

/** Everything for one Short that is for the creator, not for Flow. */
export function shortExtras(short: NextShort): string {
  const p = short.storyboard.packaging;
  return [`Title: ${p.title}`, `Description: ${p.description}${p.hashtags.length ? ` ${p.hashtags.join(' ')}` : ''}`, `Cover frame: from shot ${p.coverShot}`].join('\n');
}

/** Every Short in one paste, for the Agent after its instructions are set. */
export function flowBatch(shorts: NextShort[], mode: FlowMode): string {
  return shorts.map((s, i) => shortPrompt(s, i, mode)).join('\n\n---\n\n');
}
