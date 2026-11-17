/**
 * The text the creator pastes into Google Flow, built from the pack without AI. Step 1 is the
 * project's Agent Instructions; step 2 is one paste for the images and one for the clips
 * (clip-1: [Product name] …), each clip one 8-second generation on the creator's own photo.
 */
import { MODELS } from '../../youtube/next-shorts/models';
import { CLIP_SECONDS, type VideoPack } from './types';

const clean = (v: string) => v.trim().replace(/\.+$/, '');
const MOVE: Record<string, string> = {
  none: 'Static camera, no movement.',
  push_in: 'Slow, steady push-in toward the product.',
  pull_back: 'Slow, steady pull-back from the product.',
  pan: 'Slow pan following the action.',
  tilt: 'Slow tilt following the action.',
  orbit: 'Slow partial orbit around the product.',
};

export function agentInstructions(pack: VideoPack): string {
  const model = MODELS[pack.model].label;
  const n = pack.products.length;
  return `Project: a fast product-review YouTube Short (${n * CLIP_SECONDS} seconds, ${n} products, ${CLIP_SECONDS} seconds each), vertical 9:16, made with ${model}.

How I work:
- I upload a real photo of each product (IMAGE P1, P2…). Keep each product exactly as in its photo: shape, colors, buttons, labels, logo and size. Never invent a different design or branding.
- For every clip, first make its START IMAGE by editing that product's photo as written (the product in a real setting, in use). Then make the ${CLIP_SECONDS}-second video from that start image.
- Each clip is its own generation; I join them in order.
- Generate right away when I send images or clips: don't ask me to confirm, don't stop to list a plan, and don't wait between items. If something is unclear, make the simplest choice that follows these rules and keep going.

Rules for every clip:
- A review, not an ad: show the product clearly and doing its real job, the way a buyer would use it. No exaggerated results.
- Fast pace: the first frame is already in motion, one clear action, brisk and decisive; no slow drifting or lingering.
- One subject, one action, one camera position, at most one camera move.
- Look (same in every clip): ${clean(pack.script.look)}.
- No text, captions, prices or logos added to the video.
- Voice: ${clean(pack.script.voice)}, English, fast but clear (about 200 words a minute). Speak only the line in quotes for that clip. No music.`;
}

export function imagesBlock(pack: VideoPack): string {
  const photos = pack.products.map((p, i) => `IMAGE P${i + 1} (upload your own photo): ${p.title.slice(0, 120)}`);
  const starts = pack.script.clips.map((c, i) => `START IMAGE S${i + 1} (edit of IMAGE P${i + 1}, keep the product identical): ${clean(c.startImage)}.`);
  return [
    'Make these images for one Short, in order. Vertical 9:16, photorealistic, no text or logos added. Upload my product photos first (P1…), then make each start image (S1…) by editing its product photo: change only the setting, hands and light written, never the product.',
    '',
    ...photos,
    '',
    ...starts,
  ].join('\n');
}

export function clipsBlock(pack: VideoPack): string {
  const intro = `Make these ${pack.script.clips.length} clips, ${CLIP_SECONDS} seconds each, in order. Each clip starts exactly on its START IMAGE and keeps the product identical to its photo. Generate all clips now, one after another.`;
  const clips = pack.script.clips.map((c, i) =>
    [
      `clip-${i + 1}: [${c.productName}]`,
      `Start frame: START IMAGE S${i + 1}. Product reference: IMAGE P${i + 1}.`,
      `SUBJECT: ${clean(c.subject)}.`,
      `ACTION: ${clean(c.action)}. Already happening at the first frame; it finishes within ${CLIP_SECONDS} seconds.`,
      `SETTING: ${clean(c.setting)}.`,
      `CAMERA: ${clean(c.camera.position)}. ${MOVE[c.camera.movement] ?? MOVE.none}`,
      `LIGHTING: ${clean(c.lighting)}.`,
      `VOICEOVER: "${c.voiceover.trim()}"`,
    ].join('\n'),
  );
  return [intro, ...clips].join('\n\n');
}

export function editingSteps(pack: VideoPack): string[] {
  const texts = pack.script.clips.filter((c) => c.onScreenText).map((c, i) => `clip-${i + 1} “${c.onScreenText}”`);
  return [
    `Join the clips in order in Scenebuilder: ${pack.script.clips.map((c, i) => `${i + 1}. ${c.productName}`).join(' · ')}. Cut straight, no fades.`,
    'If Flow’s voice is off, record the voiceover lines yourself at about 200 words a minute, one line per clip.',
    ...(texts.length ? [`On-screen text (add in editing, first second of each clip): ${texts.join(' · ')}.`] : []),
    'Pin the description’s bio link, and say “links in my bio” at the end if there’s room.',
    'When you upload, turn on YouTube’s “altered or synthetic content” label, and keep the Amazon disclosure in the description.',
  ];
}
