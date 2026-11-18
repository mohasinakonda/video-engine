import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeShot, cameraConflict, countActions } from './complexity';
import { audioPlanText, flowBatch, flowInstruction, imagesPrompt, postProduction, setupSteps, shotPrompt, shotsPrompt } from './flow-text';
import { readInsights } from './insights';
import { fitGeneration, MODELS } from './models';
import { rawSeconds } from './pacing';
import { writeShortPackaging } from './packaging';
import { scoreStoryboard } from './score';
import type { Asset, NextShort, NextShortsRequest, Shot, ShortInput, Storyboard } from './types';
import { resolve, shotStarts, totalSeconds, validateStoryboard } from './validate';
import { rewriteShort, writeNextShorts } from './writer';

const llm = vi.hoisted(() => ({ answers: [] as string[], calls: 0 }));
vi.mock('@/lib/llm-providers', async (orig) => ({
  ...(await orig<typeof import('@/lib/llm-providers')>()),
  callLLM: async () => {
    llm.calls++;
    const content = llm.answers.shift();
    return content ? { content, model: 'test' } : null;
  },
}));

// Detail Dose's real numbers (views check, Nov 2026).
const s = (videoId: string, title: string, sec: number, views: number, swipe: number, watched: number, drop: number, topic: string): ShortInput => ({
  videoId,
  title,
  views,
  durationSec: sec,
  estSwipeAway: swipe,
  avgViewPct: watched,
  biggestDrop: { atSec: drop, lost: 0.1 },
  exitWindow: null,
  topic,
});
const detailDose: ShortInput[] = [
  s('a', 'how to clean car interior pro order', 72, 1141, 0.38, 51.7, 69.8, 'Interior Cleaning'),
  s('b', 'Amazon Car Gadgets Must Haves Under $25', 67, 1224, 0.73, 27.9, 5.4, 'Car Gadgets'),
  s('c', 'Tire Kicker tire shine', 18, 673, 0.73, 60.5, 5.8, 'Exterior Care'),
  s('d', 'BISSELL Little Green Mini', 25, 103, 0.74, 140.1, 3.5, 'Interior Cleaning'),
  s('e', 'Total Interior Cleaner', 19, 976, 0.76, 70.9, 4.4, 'Interior Cleaning'),
  s('f', 'Cheap Kit That Makes Your Car Look Expensive', 23, 741, 0.79, 44.7, 4.8, 'Car Gadgets'),
  s('g', 'Headlight Restoration Kit', 25, 2120, 0.8, 113.3, 5.3, 'Exterior Care'),
  s('h', 'The Car Gadget That Can Save Your Night', 55, 906, 0.82, 41, 5, 'Car Gadgets'),
];

describe('readInsights', () => {
  it('finds the best start, the 0:05 wall, rewatched Shorts and the length that works', () => {
    const i = readInsights(detailDose);
    expect(i.winners.map((w) => w.videoId)).toEqual(['a']); // the others aren't clearly better than typical
    expect(i.losers[0].videoId).toBe('h');
    expect(i.dropWall).toEqual({ atSec: 5, shorts: 7 });
    expect(i.rewatched.map((r) => r.videoId)).toEqual(['d', 'g']);
    expect(i.byLength.short).toBeGreaterThan(i.byLength.long as number);
    expect(i.bestTopic).toBe('Interior Cleaning');
    expect(i.lines.join('\n')).toMatch(/7 of 8 Shorts lose the most viewers at about 0:05/);
  });

  it('reports no wall when drops are spread out', () => {
    const spread = detailDose.map((x, n) => ({ ...x, biggestDrop: { atSec: 2 + n * 3, lost: 0.1 } }));
    expect(readInsights(spread).dropWall).toBeNull();
  });
});

// ─── The test case: a 24s upholstery cleaning ad, beige seat with a coffee stain ───

const shot = (over: Partial<Shot>): Shot => ({
  title: 'Shot',
  purpose: 'Show the result',
  subject: 'A beige fabric car seat',
  action: 'Nothing moves but the light',
  stateBefore: 'clean',
  stateAfter: 'clean',
  camera: { position: 'Low three-quarter angle at seat height', movement: 'none' },
  environment: 'Bright, tidy garage with a grey concrete floor',
  lighting: 'Soft daylight from a large window on the left',
  composition: 'Seat fills the lower two thirds of the frame',
  continuity: { with: null, kind: 'none', keep: [] },
  references: [],
  startFrame: null,
  endFrame: null,
  seconds: 4,
  speed: 'real_time',
  ambient: null,
  ...over,
});

const asset = (id: string, over: Partial<Asset>): Asset => ({
  id,
  kind: 'state',
  state: null,
  description: 'A beige fabric car seat with tan stitching',
  editOf: 'A1',
  fromCreator: false,
  ...over,
});
const seatAssets: Asset[] = [
  asset('A1', { kind: 'base_plate', editOf: null, description: 'Beige fabric car seat with tan stitching, three-quarter view, bright garage' }),
  asset('A2', { state: 'stained', description: 'Same beige seat with a dark coffee stain the size of a palm on the cushion' }),
  asset('A3', { state: 'clean', description: 'Same beige seat, spotless, fabric nap even' }),
  asset('A4', { kind: 'product', editOf: null, fromCreator: true, description: 'Your upholstery extractor: the clear nozzle and handle' }),
];
const seat = ['beige fabric color', 'tan stitching', 'seat shape'];

/** What the old implementation produced. */
const oldOutput: Storyboard = {
  brief: { promise: 'p', hook: 'h', ending: 'e' },
  assets: [...seatAssets, asset('A5', { state: 'stained', description: 'Split screen: left half stained, right half clean beige seat' })],
  shots: [
    shot({
      title: 'Spray and extract',
      subject: 'A gloved hand, a spray bottle and an upholstery extractor',
      action: 'The hand sprays the stain, sets the bottle down, picks up the extractor, suction pulls the coffee out, the stain disappears, the hand leaves the frame',
      stateBefore: 'stained',
      stateAfter: 'clean',
      seconds: 8,
      references: [{ asset: 'A4', preserve: ['nozzle shape'] }],
    }),
    shot({
      title: 'Wipe and reveal',
      subject: 'A hand with a microfiber cloth',
      action: 'The camera pulls back while the hand wipes the seat with a microfiber cloth, revealing the texture',
      camera: { position: 'Static tripod close-up', movement: 'pull_back' },
      seconds: 6,
    }),
    shot({ title: 'Result', action: 'The clean seat glows in the light', seconds: 10, startFrame: 'A3', endFrame: 'A5' }),
  ],
  audio: { voiceover: [], sfx: [], ambient: null, music: null },
  captions: [],
  packaging: { title: 'Coffee stain gone', description: 'd', hashtags: ['#carcare'], coverShot: 1 },
};

/** The shot-based storyboard it should become. */
const good: Storyboard = {
  brief: { promise: 'A coffee stain lifts out of a beige seat', hook: 'Extractor pass leaving a clean stripe', ending: 'Clean seat, then cut back to the first pass' },
  assets: seatAssets,
  shots: [
    shot({
      title: 'Hook: the clean stripe',
      purpose: 'Stop the swipe with the result already happening',
      subject: 'The clear extractor nozzle on the stained seat',
      action: 'The nozzle slides slowly across the coffee stain, leaving a clean stripe behind it',
      stateBefore: 'stained',
      stateAfter: 'stained',
      camera: { position: 'Macro, 20 cm above the cushion, looking down', movement: 'none' },
      startFrame: 'A2',
      references: [
        { asset: 'A2', preserve: seat },
        { asset: 'A4', preserve: ['nozzle shape', 'clear plastic'] },
      ],
      seconds: 2,
    }),
    shot({
      title: 'Spray',
      purpose: 'Show the first step',
      subject: 'A gloved hand holding a plain spray bottle',
      action: 'The hand sprays a fine mist of cleaner onto the coffee stain',
      stateBefore: 'stained',
      stateAfter: 'stained',
      camera: { position: 'Close-up at cushion height', movement: 'none' },
      continuity: { with: 1, kind: 'visual', keep: seat },
      references: [{ asset: 'A2', preserve: seat }],
      seconds: 4,
    }),
    shot({
      title: 'Extraction',
      purpose: 'The main action',
      subject: 'The clear extractor nozzle',
      action: 'The nozzle makes one slow pass over the stain as brown water rises inside it',
      stateBefore: 'stained',
      stateAfter: 'clean',
      camera: { position: 'Close-up at cushion height', movement: 'none' },
      continuity: { with: 2, kind: 'exact_frame', keep: seat },
      references: [
        { asset: 'A2', preserve: seat },
        { asset: 'A4', preserve: ['nozzle shape'] },
      ],
      seconds: 5,
    }),
    shot({
      title: 'Dirty water',
      purpose: 'Proof of what came out',
      subject: 'The extractor’s clear recovery tank',
      action: 'Brown water settles inside the clear tank',
      stateBefore: null,
      stateAfter: null,
      camera: { position: 'Close-up of the tank at eye level', movement: 'none' },
      references: [{ asset: 'A4', preserve: ['tank shape', 'clear plastic'] }],
      seconds: 4,
    }),
    shot({
      title: 'Fabric nap',
      purpose: 'Show the texture is back',
      subject: 'A soft brush on the clean cushion',
      action: 'The brush strokes the damp fabric nap in one direction',
      camera: { position: 'Macro at cushion height', movement: 'none' },
      continuity: { with: 3, kind: 'visual', keep: seat },
      references: [{ asset: 'A3', preserve: seat }],
      seconds: 4,
    }),
    shot({
      title: 'Result',
      purpose: 'The clean seat, to cut back to shot 1',
      subject: 'The clean beige seat',
      action: 'The camera slowly moves closer to the spotless cushion',
      camera: { position: 'Three-quarter view at seat height', movement: 'push_in' },
      continuity: { with: 5, kind: 'visual', keep: seat },
      startFrame: 'A3',
      references: [{ asset: 'A3', preserve: seat }],
      seconds: 5,
    }),
  ],
  audio: {
    voiceover: [
      { shot: 1, text: 'Coffee. Gone.' },
      { shot: 6, text: 'Your seat, like new.' },
    ],
    sfx: [
      { shot: 2, sound: 'spray hiss' },
      { shot: 3, sound: 'strong suction' },
    ],
    ambient: 'quiet garage',
    music: null,
  },
  captions: [{ shot: 1, text: 'COFFEE STAIN' }],
  packaging: { title: 'A coffee stain, one pass', description: 'Lifting a coffee stain out of a fabric seat.', hashtags: ['#carcare'], coverShot: 1 },
};

describe('complexity analyzer', () => {
  it('counts separate actions', () => {
    expect(countActions('The nozzle slides across the stain, leaving a clean stripe behind it')).toBe(1);
    expect(countActions('The hand sprays the stain, sets the bottle down, picks up the extractor')).toBe(3);
    expect(countActions('Brown water settles inside the clear tank')).toBe(1);
    expect(countActions('Static shot of the stain, no movement')).toBe(1);
    // Commas between adjectives, and the result told with -ing, are still one action (from real AI output).
    expect(countActions('An extractor tool is pulled across the stain, leaving a clean, wet stripe in its wake.')).toBe(1);
    expect(countActions('A gloved hand opens the tank, revealing the murky, brown dirty water collected from the seat.')).toBe(1);
    expect(countActions('No stain, fabric returning to original color')).toBe(1);
    expect(countActions('The polishing pad spins in place on the cloudy surface, creating a circular motion.')).toBe(1);
    expect(countActions('A gloved hand sprays cleaner and wipes it off')).toBe(2);
    expect(countActions('The hand brushes the seat, then the extractor passes over it')).toBe(2);
  });

  it('flags the old 8-second clip as too much for one generation', () => {
    const c = analyzeShot(oldOutput.shots[0]);
    expect(c.actions).toBeGreaterThanOrEqual(5);
    expect(c.score).toBe(100);
    expect(c.fixes.join()).toMatch(/one action/);
  });

  it('flags a camera move during a hand action, and a locked camera that moves', () => {
    const c = analyzeShot(oldOutput.shots[1]);
    expect(c.reasons.join()).toMatch(/camera moves during a hand or liquid action/);
    expect(cameraConflict(oldOutput.shots[1])).toMatch(/locked/);
    expect(cameraConflict(shot({ action: 'The camera pulls back from the seat' }))).toMatch(/static, but the shot describes a camera move/);
  });
});

describe('the old output', () => {
  const { storyboard, fixes } = resolve(oldOutput, 'veo_lite');
  const issues = validateStoryboard(storyboard, 'veo_lite', 5);
  const text = issues.map((i) => `${i.shot}: ${i.message}`).join('\n');

  it('drops the end frame that shows the opposite state', () => {
    expect(fixes.join()).toMatch(/Shot 3: removed end frame A5: it shows "stained", but the shot ends "clean"/);
    expect(storyboard.shots[2].endFrame).toBeNull();
  });

  it('blocks the split-screen reference, the overloaded shots and the camera conflict', () => {
    expect(text).toMatch(/IMAGE A5 is a split screen/);
    expect(text).toMatch(/1: Too much for one generation/);
    expect(text).toMatch(/2: .*locked/);
    expect(text).toMatch(/3: Veo 3.1 Lite can’t make a 10s clip/);
    expect(text).toMatch(/hook shot is 8s/);
  });

  it('removes a time the title can’t prove, and asks for state images when the object changes', () => {
    const r = resolve({ ...good, packaging: { ...good.packaging, title: 'Headlight Restoration in Seconds' } }, 'omni');
    expect(r.storyboard.packaging.title).toBe('Headlight Restoration');
    expect(r.fixes.join()).toMatch(/removed a time/);
    const noStates = {
      ...good,
      assets: good.assets.filter((a) => a.kind !== 'state'),
      shots: good.shots.map((x) => ({ ...x, startFrame: null, references: x.references.filter((ref) => ref.asset === 'A4') })),
    };
    expect(
      validateStoryboard(noStates, 'omni', 5)
        .map((i) => i.message)
        .join(),
    ).toMatch(/no state images/);
  });

  it('scores low, with reasons', () => {
    const { readiness, shots } = scoreStoryboard(storyboard, issues, 'veo_lite');
    expect(readiness).toBeLessThan(40);
    expect(shots[0].readinessReasons.join()).toMatch(/hard to generate/);
  });
});

describe('the shot-based storyboard', () => {
  it('passes every blocking rule on both models', () => {
    for (const mode of ['omni', 'veo_lite'] as const) {
      const { storyboard, fixes } = resolve(good, mode);
      const blocks = validateStoryboard(storyboard, mode, 5, 'steady').filter((i) => i.level === 'block');
      expect(blocks).toEqual([]);
      expect(fixes).toEqual([]);
    }
    expect(totalSeconds(good)).toBe(24);
    expect(shotStarts(good)).toEqual([0, 2, 6, 11, 15, 19]);
  });

  it('keeps every shot simple enough and scores it ready', () => {
    const issues = validateStoryboard(good, 'omni', 5, 'steady');
    const { readiness, shots } = scoreStoryboard(good, issues, 'omni');
    expect(Math.max(...shots.map((x) => x.complexity))).toBeLessThanOrEqual(60);
    expect(readiness).toBeGreaterThanOrEqual(70);
  });

  it('warns about a shot where nothing happens', () => {
    const dead = {
      ...good,
      shots: good.shots.map((x, i) => (i === 5 ? { ...x, action: 'Static shot of the clean seat, no movement', camera: { ...x.camera, movement: 'none' as const } } : x)),
    };
    expect(validateStoryboard(dead, 'omni', 5, 'steady').find((i) => i.shot === 6)?.message).toMatch(/Nothing moves or changes/);
  });

  it('warns about a voiceover at the drop wall', () => {
    const talking = { ...good, audio: { ...good.audio, voiceover: [{ shot: 2, text: 'Spray it first.' }] } };
    expect(
      validateStoryboard(talking, 'omni', 5)
        .map((i) => i.message)
        .join(),
    ).toMatch(/Voiceover around 5s/);
  });
});

describe('models', () => {
  it('fits each shot to a length the model can make', () => {
    expect(fitGeneration(2, MODELS.veo_lite, false)).toEqual({ seconds: 4, trim: 2 });
    expect(fitGeneration(5, MODELS.veo_lite, true)).toEqual({ seconds: 8, trim: 3 }); // references: 8s only
    expect(fitGeneration(2, MODELS.omni, true)).toEqual({ seconds: 3, trim: 1 });
    expect(fitGeneration(10, MODELS.veo_lite, false)).toBeNull();
    expect(MODELS.omni.lastFrame).toBe('unknown');
  });

  it('drops an end frame the model may not take', () => {
    const withEnd = { ...good, shots: good.shots.map((x, i) => (i === 2 ? { ...x, endFrame: 'A3' } : x)) };
    expect(resolve(withEnd, 'omni').fixes.join()).toMatch(/Omni Flash 1.2 may not take one/);
    expect(resolve(withEnd, 'veo_lite').storyboard.shots[2].endFrame).toBe('A3');
  });
});

const style = { audience: 'US car owners', look: 'Bright garage, soft daylight, macro detail', voice: 'calm male' };
const short: NextShort = {
  id: 's1',
  name: 'Coffee stain',
  basedOn: null,
  basedOnTitle: null,
  why: 'w',
  storyboard: good,
  seconds: 24,
  voiceWords: 7,
  shots: scoreStoryboard(good, [], 'omni').shots,
  readiness: 90,
  fixes: [],
  issues: [],
};

describe('flow text', () => {
  it('writes one prompt per shot in the field order', () => {
    const p = shotPrompt(good, 2, 'veo_lite');
    expect(p.split('\n').map((l) => l.split(':')[0])).toEqual([
      'SHOT 3 of 6',
      'SUBJECT',
      'ACTION',
      'ENVIRONMENT',
      'REFERENCE IDENTITY',
      'CAMERA POSITION',
      'CAMERA MOVEMENT',
      'LIGHTING',
      'COMPOSITION',
      'MOTION AND TIMING',
      'CONTINUITY',
    ]);
    expect(p).toContain('SHOT 3 of 6: Extraction (generate 8s, use 5s)');
    expect(p).toContain('CAMERA MOVEMENT: Static camera, no movement.');
    expect(p).toContain('It starts stained and ends clean.');
    expect(p).toContain('CONTINUITY: This shot continues exactly from the last frame of SHOT 2; keep beige fabric color, tan stitching, seat shape the same.');
    expect(p).not.toMatch(/\/\w+|\[00:/); // no slash commands, no timeline
  });

  it('starts the result shot on the clean image, and lists images first', () => {
    expect(shotPrompt(good, 5, 'omni')).toContain('Start frame: IMAGE A3 (clean).');
    const images = imagesPrompt({ ...good, assets: [seatAssets[2], seatAssets[3], seatAssets[1], seatAssets[0]] }).split('\n');
    expect(images[0]).toMatch(/^Make these reference images for one Short, in this order\..*Make IMAGE A1 first: it is the main image\..*editing that image/);
    // Main image first, then its edits, then the creator's own photo, whatever order the AI listed them in.
    expect(images.slice(2)).toEqual([
      'IMAGE A1 (main image): Beige fabric car seat with tan stitching, three-quarter view, bright garage.',
      'IMAGE A3 (edit of IMAGE A1): Same beige seat, spotless, fabric nap even.',
      'IMAGE A2 (edit of IMAGE A1): Same beige seat with a dark coffee stain the size of a palm on the cushion.',
      'IMAGE A4 (I will upload my own photo): Your upholstery extractor: the clear nozzle and handle.',
    ]);
    const shots = shotsPrompt(good, 'omni');
    expect(shots).toMatch(/^Make these 6 shots for one Short with Omni Flash 1\.2\./);
    expect(
      shots
        .split('\n\n')
        .map((b) => b.split(':')[0])
        .slice(1),
    ).toEqual(['SHOT 1 of 6', 'SHOT 2 of 6', 'SHOT 3 of 6', 'SHOT 4 of 6', 'SHOT 5 of 6', 'SHOT 6 of 6']);
    expect(flowBatch([short], 'omni')).toMatch(/^SHORT 1: Coffee stain\. 24 seconds, 6 shots\.\n\nMake these reference images/);
  });

  it('keeps sound and editing apart from the shots', () => {
    expect(audioPlanText(good)).toBe(
      '0:00 (shot 1) Voiceover: "Coffee. Gone."\n0:02 (shot 2) SFX: spray hiss\n0:06 (shot 3) SFX: strong suction\n0:19 (shot 6) Voiceover: "Your seat, like new."\nAmbient, whole Short: quiet garage\nMusic: none',
    );
    expect(postProduction(good, 'veo_lite')[0]).toMatch(/Shot 1 at 0:00: 2s \(trim 6s from the 8s clip\)/);
    expect(shotPrompt(good, 0, 'omni')).not.toMatch(/AUDIO|Voiceover/);
  });

  it('writes the Agent Instructions with the channel facts and no old titles', () => {
    const text = flowInstruction('Detail Dose', style, readInsights(detailDose), 'omni');
    expect(text).toContain('"Detail Dose"');
    expect(text).toContain('Every SHOT is its own generation with Omni Flash 1.2');
    expect(text).toContain('Generate right away');
    expect(text).not.toMatch(/wait for my OK|confirm before/);
    expect(text).not.toContain('Best start: "');
    expect(setupSteps('veo_lite').join()).toMatch(/Reference images work only on 8-second clips/);
  });
});

describe('writeNextShorts', () => {
  // The coffee-stain storyboard has 4–5s shots: a steady pace.
  const req: NextShortsRequest = { count: 3, mode: 'omni', pace: 'steady', channelTitle: 'Detail Dose', shorts: detailDose };
  const plan = (n: number) => JSON.stringify({ style, ideas: Array.from({ length: n }, (_, i) => ({ name: `Idea ${i + 1}`, basedOn: i === 0 ? 'g' : 'nope', why: 'because' })) });

  beforeEach(() => {
    llm.answers = [];
    llm.calls = 0;
  });

  it('plans, writes a storyboard per Short, scores it and builds the Agent Instructions', async () => {
    llm.answers = [plan(2), JSON.stringify(good), JSON.stringify(good)];
    const pack = await writeNextShorts(req, ['m']);
    expect(pack?.version).toBe(3);
    expect(pack?.shorts).toHaveLength(2);
    expect(pack?.shorts[0].basedOnTitle).toBe('Headlight Restoration Kit');
    expect(pack?.shorts[1].basedOn).toBeNull();
    expect(pack?.shorts[0].issues.filter((i) => i.level === 'block')).toEqual([]);
    expect(pack?.shorts[0].readiness).toBeGreaterThanOrEqual(70);
    expect(llm.calls).toBe(3);
  });

  it('sends a blocked storyboard back once and keeps the better one', async () => {
    llm.answers = [plan(1), JSON.stringify(oldOutput), JSON.stringify(good)];
    const pack = await writeNextShorts(req, ['m']);
    expect(pack?.shorts[0].storyboard.shots).toHaveLength(6);
    expect(llm.calls).toBe(3);
  });

  it('returns null when the AI gives nothing', async () => {
    expect(await writeNextShorts(req, ['m'])).toBeNull();
  });
});

describe('writeShortPackaging', () => {
  const req = {
    channelTitle: 'Detail Dose',
    short: { name: 'Coffee stain', why: 'w', promise: 'p', hook: 'h', ending: 'e', shots: good.shots.map((x) => ({ title: x.title, action: x.action })) },
  };
  const answer = (titles: string[]) =>
    JSON.stringify({
      titles: titles.map((t) => ({ title: t, angle: 'result' })),
      description: 'A coffee stain lifts out of a fabric seat.',
      hashtags: ['carcare', '#shorts', '#detailing', '#a', '#b'],
      coverShot: 9,
      coverText: 'COFFEE STAIN GONE FOREVER NOW',
      pinnedComment: 'What stain is on your seat right now?',
    });

  beforeEach(() => {
    llm.answers = [];
    llm.calls = 0;
  });

  it('drops titles that break the rules and tidies hashtags and the cover', async () => {
    llm.answers = [answer(['A coffee stain, one pass', 'Gone in seconds', 'Seat cleaning Part 2', 'Would you sit on this seat? #car'])];
    const p = await writeShortPackaging(req, ['m']);
    expect(p?.titles.map((t) => t.title)).toEqual(['A coffee stain, one pass', 'Would you sit on this seat?']);
    expect(p?.hashtags).toEqual(['#carcare', '#detailing', '#a']);
    expect(p?.coverShot).toBe(6);
    expect(p?.coverText).toBe('COFFEE STAIN GONE FOREVER');
    expect(llm.calls).toBe(1);
  });

  it('asks again when fewer than two titles survive', async () => {
    llm.answers = [answer(['Gone in seconds', 'Part 2 of the seat']), answer(['One pass, no stain', 'Is your seat this dirty?'])];
    const p = await writeShortPackaging(req, ['m']);
    expect(p?.titles).toHaveLength(2);
    expect(llm.calls).toBe(2);
  });
});

describe('rewriteShort', () => {
  beforeEach(() => {
    llm.answers = [];
    llm.calls = 0;
  });

  it('writes a new storyboard for the same idea, keeping its id and name', async () => {
    llm.answers = [JSON.stringify(good)];
    const s = await rewriteShort(
      {
        channelTitle: 'Detail Dose',
        mode: 'omni',
        pace: 'steady',
        style,
        facts: [],
        dropWall: 5,
        short: { id: 's2', name: 'Coffee stain', basedOn: null, basedOnTitle: null, why: 'w', previousShots: ['Hook: split screen'] },
        feedback: 'No hands please',
      },
      ['m'],
    );
    expect(s?.id).toBe('s2');
    expect(s?.name).toBe('Coffee stain');
    expect(s?.storyboard.shots).toHaveLength(6);
    expect(s?.packagingOptions).toBeUndefined();
    expect(llm.calls).toBe(1);
  });

  it('returns null when the AI gives nothing', async () => {
    const req = {
      channelTitle: 'D',
      mode: 'omni' as const,
      pace: 'steady' as const,
      style,
      facts: [],
      dropWall: null,
      short: { id: 's1', name: 'n', basedOn: null, basedOnTitle: null, why: 'w', previousShots: [] },
    };
    expect(await rewriteShort(req, ['m'])).toBeNull();
  });
});

describe('pacing', () => {
  it('blocks shots too long for a fast Short, and passes the same story cut fast', () => {
    const slow = validateStoryboard(good, 'omni', 5, 'fast').filter((i) => i.level === 'block');
    expect(slow.map((i) => i.shot)).toEqual([2, 3, 4, 5, 6]);
    expect(slow[1].message).toMatch(/5s on screen is too slow for a fast Short \(at most 3s\)/);

    const fast: Storyboard = {
      ...good,
      shots: good.shots.map((x, i) => ({ ...x, seconds: [2, 2, 3, 3, 3, 3][i], speed: i === 2 ? ('fast_forward' as const) : x.speed })),
    };
    expect(validateStoryboard(fast, 'omni', 5, 'fast').filter((i) => i.level === 'block')).toEqual([]);
    expect(rawSeconds(fast.shots[2])).toBe(6);
    expect(shotPrompt(fast, 2, 'omni')).toMatch(/\(generate 6s\)[\s\S]*MOTION AND TIMING: One continuous action over 6 seconds\. Natural speed \(I speed it up 2× in editing\)/);
    expect(postProduction(fast, 'omni', 'fast').join('\n')).toMatch(/Shot 3 at 0:04: 3s \(speed up 2× to 3s\)[\s\S]*Pace: fast, no shot longer than 3s on screen/);
  });

  it('never opens in slow motion, and never says "unhurried"', () => {
    const slowHook = { ...good, shots: good.shots.map((x, i) => (i === 0 ? { ...x, speed: 'slow_motion' as const } : x)) };
    expect(
      validateStoryboard(slowHook, 'omni', 5, 'steady')
        .map((i) => i.message)
        .join(),
    ).toMatch(/hook is in slow motion/);
    expect(shotPrompt(good, 1, 'omni')).toContain('Brisk, decisive motion at real speed');
    expect(flowBatch([short], 'omni')).not.toMatch(/unhurried/);
    expect(flowInstruction('Detail Dose', style, readInsights(detailDose), 'omni', 'very_fast')).toMatch(/Pace: very fast\. Shorts are fast/);
  });
});
