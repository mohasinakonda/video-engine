/**
 * The AI part: ideas for the batch from the channel's own numbers, then one storyboard per Short:
 * separate shots, reference images and an audio plan, as structured fields (the prompts are
 * assembled without AI in flow-text.ts). Each storyboard is fixed where safe, validated, sent
 * back once if a shot is too complex or contradicts itself, and scored.
 */
import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { flowInstruction } from './flow-text';
import { readInsights } from './insights';
import { MODELS, type FlowMode } from './models';
import { DEFAULT_PACE, PACES, SPEED_IDS, type Pace } from './pacing';
import { scoreStoryboard } from './score';
import {
  CAMERA_MOVES,
  CAPTION_MAX_WORDS,
  MAX_HASHTAGS,
  MAX_SECONDS,
  MIN_SECONDS,
  TITLE_MAX,
  ideaSchema,
  storyboardSchema,
  styleSchema,
  type Insights,
  type Issue,
  type NextShort,
  type NextShortsPack,
  type NextShortsRequest,
  type RewriteRequest,
  type ShortIdea,
  type Storyboard,
} from './types';
import { maxVoiceWords, resolve, totalSeconds, validateStoryboard, voiceWords } from './validate';

/** Scripts written at the same time. */
const PARALLEL = 5;
const TIMEOUT_MS = 60_000;

const RULES = `Rules for every Short:
- English only. Very few spoken words.
- ${MIN_SECONDS}–${MAX_SECONDS} seconds in total, never longer.
- Viewers decide in the first half second. The first shot (1–2 seconds) shows the most satisfying moment already happening (for example an extractor pass leaving a clean stripe through a stain). Never open on setup (picking up a tool), an intro, logo or title card. No split screens.
- The picture changes by 3–5 seconds (the next shot), with no talking around the second where this channel's viewers leave.
- Only claim what the picture shows; no prices, brands, statistics or promises you can't see. Never name brands: say what the thing is.`;

function context(req: NextShortsRequest, insights: Insights) {
  return {
    channel: req.channelTitle,
    creatorNotes: req.notes || null,
    facts: insights.lines,
    shorts: req.shorts.slice(0, 30).map((s) => ({
      videoId: s.videoId,
      title: s.title,
      seconds: s.durationSec,
      swipedAwayPer100: s.estSwipeAway === null ? null : Math.round(s.estSwipeAway * 100),
      watchedPct: s.avgViewPct === null ? null : Math.round(s.avgViewPct),
      views: s.views,
      mostLeaveAtSec: s.biggestDrop ? Math.round(s.biggestDrop.atSec) : null,
      topic: s.topic ?? null,
    })),
  };
}

// ─── Stage 1: ideas and the shared style ────────────────────────────────────

const PLAN_SYSTEM = `You plan the next YouTube Shorts for a creator, from their own channel's numbers.
Lower "swipedAwayPer100" means a better opening; "watchedPct" over 100 means people rewatched it.
Build on what worked (the best openings, rewatched Shorts, the best topic) and avoid what the weakest Shorts did.
Never use brand or product names in names or descriptions (the video model would draw them); say what the thing is ("a mini extractor").
Give each idea a different angle: a part 2 of a winner, the same format on a new subject, or the winner's opening with a new payoff. Stay in the channel's niche.
Also describe one look shared by every Short so they feel like one channel (setting, one light condition, camera, subject, hands), the audience, and the voice.
${RULES}
Reply only with JSON:
{"style": {"audience": "...", "look": "...", "voice": "calm, confident American male, close-mic"},
 "ideas": [{"name": "<short working name, no brand or product names>", "basedOn": "<videoId of the channel Short it builds on, or null>", "why": "<one sentence with the number from the facts that makes this a good bet>"}]}`;

const planSchema = z.object({ style: styleSchema, ideas: z.array(ideaSchema).min(1) });

async function planBatch(req: NextShortsRequest, insights: Insights, models: string[]) {
  const answer = await callLLM({
    messages: [
      { role: 'system', content: PLAN_SYSTEM },
      { role: 'user', content: JSON.stringify({ ...context(req, insights), ideasWanted: req.count }) },
    ],
    json: true,
    temperature: 0.7,
    maxTokens: 3000,
    timeoutMs: TIMEOUT_MS,
    models,
    tag: 'next-shorts/plan',
    accept: (c) => planSchema.safeParse(parseJsonObject(c)).success,
  });
  if (!answer) return null;
  const plan = planSchema.parse(parseJsonObject(answer.content));
  const known = new Set(req.shorts.map((s) => s.videoId));
  return { style: plan.style, ideas: plan.ideas.slice(0, req.count).map((i) => ({ ...i, basedOn: i.basedOn && known.has(i.basedOn) ? i.basedOn : null })) };
}

// ─── Stage 2: one storyboard per Short ──────────────────────────────────────

const storyboardSystem = (mode: FlowMode, pace: Pace) => {
  const model = MODELS[mode];
  const rule = PACES[pace];
  return `You are a director planning one YouTube Short for AI video generation with ${model.label} in Google Flow.
Each shot becomes its own separate generation, so plan shots a video model can actually make:
- ${rule.shots[0]}–${rule.shots[1]} shots. Each shot has ONE subject, ONE physical action (no "then", no lists of actions), ONE camera position and at most ONE camera move.
- Never move the camera while hands use a tool or liquid moves: lock the camera for those shots.
- Keep liquids, suction and splashes to the shots that need them, one per shot.
- Aim for 20–25 seconds in total (this channel's best Shorts are about that long).
- PACE: ${rule.label.toLowerCase()} (${rule.hint}). Shorts lose viewers when they feel slow, unlike long videos. "seconds" is SCREEN time: at most ${rule.maxShot}s per shot, the first shot at most ${rule.hookMax}s. Cut on the action.
- "speed" per shot: "real_time" (default), "fast_forward" (a longer action, like a full wipe or pass, shown at 2× in editing: it is generated twice as long), "speed_ramp" (fast in, slow on the key moment), "slow_motion" (only for the payoff, never the first shot). Use fast_forward instead of a slow shot.
- ${model.label} makes clips of ${model.durations.join(', ')} seconds; shorter shots are trimmed.
- Every shot shows one visible motion or change; never a "static shot" where nothing happens (for a result, use a slow push-in or light moving across it).
- No scene changes or split screens inside a shot. Every shot must add something new; don't repeat an action.
${RULES}

Reference images ("assets") keep the shots consistent:
- A "base_plate": the main object (for example the seat) in a neutral state, described precisely (color, fabric, stitching, shape).
- "state" images made as edits of the base plate ("editOf"): one per condition the story shows (for example "stained" and "clean"), so it is the same object.
- A "product" asset with "fromCreator": true when a real product is used: the creator uploads a photo; describe what it shows. Without a product, don't add one.
- Use an asset only for a reason, and say in "preserve" which details it keeps (shape, color, nozzle, stitching).
- startFrame: an image the shot starts exactly on; its state must equal the shot's stateBefore. endFrame: only for a controlled transition, its state must equal stateAfter; ${model.lastFrame === true ? 'this model takes end frames' : 'this model may not take end frames, so use none'}. Never use an image of the opposite state.
- The final result shot starts on the clean-state image. The loop is made in editing, not with an end frame.
- continuity: "with" is an earlier shot number; kind "exact_frame" only when the camera stays in the same position, "visual" for the same object from another angle, "temporal" for right after; "keep" lists what must stay the same.

Sound is planned apart from the pictures: "audio" lists voiceover lines and sound effects by shot number. A shot's "ambient" is one optional line.
"captions": up to 4 on-screen texts (at most ${CAPTION_MAX_WORDS} words) by shot number, added in editing.
"packaging": a title up to ${TITLE_MAX} characters with no hashtags: what the viewer sees in the first shot or the question it raises; never a working name like "Part 2" and no times or prices; a one-sentence description; up to ${MAX_HASHTAGS} hashtags; "coverShot".
Allowed camera movements: ${CAMERA_MOVES.join(', ')}. Allowed speeds: ${SPEED_IDS.join(', ')}.
Reply only with JSON:
{"brief": {"promise": "...", "hook": "<the first shot in a few words>", "ending": "<the last shot and how it cuts back to the first>"},
 "assets": [{"id": "A1", "kind": "base_plate", "state": null, "description": "...", "editOf": null, "fromCreator": false}],
 "shots": [{"title": "...", "purpose": "...", "subject": "...", "action": "...", "stateBefore": "stained", "stateAfter": "stained",
   "camera": {"position": "...", "movement": "none"}, "environment": "...", "lighting": "...", "composition": "...",
   "continuity": {"with": null, "kind": "none", "keep": []}, "references": [{"asset": "A1", "preserve": ["..."]}],
   "startFrame": null, "endFrame": null, "seconds": 2, "speed": "real_time", "ambient": null}],
 "audio": {"voiceover": [{"shot": 2, "text": "..."}], "sfx": [{"shot": 1, "sound": "..."}], "ambient": "...", "music": null},
 "captions": [{"shot": 1, "text": "..."}],
 "packaging": {"title": "...", "description": "...", "hashtags": ["#..."], "coverShot": 1}}`;
};

export interface StoryboardResult {
  storyboard: Storyboard;
  fixes: string[];
  issues: Issue[];
}

const blocks = (issues: Issue[]) => issues.filter((i) => i.level === 'block').length;

/** One storyboard: write, fix what is safe, validate, rewrite once if anything blocks. */
export async function writeStoryboard(
  concept: { channel: string; idea: ShortIdea; buildsOn: string | null; style: z.infer<typeof styleSchema>; facts: string[]; notes?: string | null },
  mode: FlowMode,
  dropWall: number | null,
  models: string[],
  pace: Pace = DEFAULT_PACE,
): Promise<StoryboardResult | null> {
  const base = {
    channel: concept.channel,
    style: concept.style,
    idea: { name: concept.idea.name, why: concept.idea.why, buildsOn: concept.buildsOn },
    facts: concept.facts,
    viewersLeaveAtSec: dropWall ?? 5,
    maxSpokenWords: { [`${MIN_SECONDS}s`]: maxVoiceWords(MIN_SECONDS), [`${MAX_SECONDS}s`]: maxVoiceWords(MAX_SECONDS) },
    creatorNotes: concept.notes || null,
  };
  const ask = async (extra: object | null): Promise<StoryboardResult | null> => {
    const answer = await callLLM({
      messages: [
        { role: 'system', content: storyboardSystem(mode, pace) },
        { role: 'user', content: JSON.stringify(extra ? { ...base, ...extra } : base) },
      ],
      json: true,
      temperature: 0.5,
      maxTokens: 5000,
      timeoutMs: TIMEOUT_MS,
      models,
      tag: 'next-shorts/storyboard',
      accept: (c) => storyboardSchema.safeParse(parseJsonObject(c)).success,
    });
    if (!answer) return null;
    const { storyboard, fixes } = resolve(storyboardSchema.parse(parseJsonObject(answer.content)), mode);
    return { storyboard, fixes, issues: validateStoryboard(storyboard, mode, dropWall, pace) };
  };

  const first = await ask(null);
  if (!first || blocks(first.issues) === 0) return first;
  const second = await ask({
    yourLastStoryboard: first.storyboard,
    fixTheseProblems: first.issues.filter((i) => i.level === 'block').map((i) => (i.shot ? `Shot ${i.shot}: ${i.message}` : i.message)),
  });
  if (!second) return first;
  return blocks(second.issues) <= blocks(first.issues) ? second : first;
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

export async function writeNextShorts(req: NextShortsRequest, models: string[], onStage: (stage: 'ideas' | 'scripts') => void = () => undefined): Promise<NextShortsPack | null> {
  const insights = readInsights(req.shorts);
  onStage('ideas');
  const plan = await planBatch(req, insights, models);
  if (!plan || plan.ideas.length === 0) return null;

  onStage('scripts');
  const titles = new Map(req.shorts.map((s) => [s.videoId, s.title]));
  const wall = insights.dropWall?.atSec ?? null;
  const results = await inBatches(plan.ideas, PARALLEL, (idea) =>
    writeStoryboard(
      { channel: req.channelTitle, idea, buildsOn: idea.basedOn ? (titles.get(idea.basedOn) ?? null) : null, style: plan.style, facts: insights.lines, notes: req.notes },
      req.mode,
      wall,
      models,
      req.pace,
    ),
  );
  const shorts: NextShort[] = [];
  plan.ideas.forEach((idea, i) => {
    const r = results[i];
    if (!r) return;
    const scored = scoreStoryboard(r.storyboard, r.issues, req.mode);
    shorts.push({
      ...idea,
      id: `s${i + 1}`,
      basedOnTitle: idea.basedOn ? (titles.get(idea.basedOn) ?? null) : null,
      storyboard: r.storyboard,
      seconds: totalSeconds(r.storyboard),
      voiceWords: voiceWords(r.storyboard),
      shots: scored.shots,
      readiness: scored.readiness,
      fixes: r.fixes,
      issues: r.issues,
    });
  });
  if (shorts.length === 0) return null;

  return {
    version: 3,
    mode: req.mode,
    pace: req.pace,
    channelTitle: req.channelTitle,
    insights,
    style: plan.style,
    shorts,
    flowInstruction: flowInstruction(req.channelTitle, plan.style, insights, req.mode, req.pace),
    generatedAt: new Date().toISOString(),
  };
}

/** The same idea, a new storyboard: for a Short the creator didn't like. */
export async function rewriteShort(req: RewriteRequest, models: string[]): Promise<NextShort | null> {
  const { short } = req;
  const notes = [
    req.feedback ? `The creator didn't like the last version. Their note: ${req.feedback}` : "The creator didn't like the last version.",
    `Make a clearly different storyboard (another hook shot and other shots) for the same idea. The last version's shots were: ${short.previousShots.join(' | ')}`,
  ].join('\n');
  const result = await writeStoryboard(
    { channel: req.channelTitle, idea: { name: short.name, basedOn: short.basedOn, why: short.why }, buildsOn: short.basedOnTitle, style: req.style, facts: req.facts, notes },
    req.mode,
    req.dropWall,
    models,
    req.pace,
  );
  if (!result) return null;
  const scored = scoreStoryboard(result.storyboard, result.issues, req.mode);
  return {
    id: short.id,
    name: short.name,
    basedOn: short.basedOn,
    basedOnTitle: short.basedOnTitle,
    why: short.why,
    storyboard: result.storyboard,
    seconds: totalSeconds(result.storyboard),
    voiceWords: voiceWords(result.storyboard),
    shots: scored.shots,
    readiness: scored.readiness,
    fixes: result.fixes,
    issues: result.issues,
  };
}
