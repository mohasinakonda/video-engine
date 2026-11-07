import { describe, expect, it } from 'vitest';
import { analyzeShort } from './engine';
import type { ChannelContext, EngineInput, FrameFinding, MeasuredSignals, ShortFormat, SpeechRun } from './types';

const STEP = 0.25;
const LSTEP = 0.1;

/** A clip where `moving(t)` and `loud(t)` describe each moment. */
function signals(dur: number, opts: { moving?: (t: number) => boolean; loud?: (t: number) => boolean; speech?: SpeechRun[]; cuts?: number[] } = {}): MeasuredSignals {
  const moving = opts.moving ?? (() => true);
  const loud = opts.loud ?? (() => true);
  return {
    durationSec: dur,
    width: 1080,
    height: 1920,
    letterboxed: false,
    motionStep: STEP,
    motion: Array.from({ length: Math.ceil(dur / STEP) }, (_, i) => (i === 0 ? 0 : moving(i * STEP) ? 0.08 : 0.005)),
    cuts: opts.cuts ?? Array.from({ length: Math.floor(dur / 2) }, (_, i) => (i + 1) * 2).filter((c) => c < dur),
    loudnessStep: LSTEP,
    loudness: Array.from({ length: Math.ceil(dur / LSTEP) }, (_, i) => (loud(i * LSTEP) ? -18 : -70)),
    clippingPct: 0,
    loopSimilarity: 0.3,
    speech: opts.speech ?? [{ start: 0.3, end: dur - 0.5, text: 'talking the whole time' }],
    speechLanguage: 'en',
  };
}

function frame(t: number, extra: Partial<FrameFinding> = {}): FrameFinding {
  return {
    t,
    subject: 'person',
    face: true,
    text: null,
    textPosition: null,
    textSide: null,
    textSize: null,
    action: true,
    watermark: 'none',
    looksReused: false,
    showsResult: false,
    ...extra,
  };
}

function input(s: MeasuredSignals, opts: { frames?: FrameFinding[]; format?: ShortFormat | null; channel?: ChannelContext | null; title?: string } = {}): EngineInput {
  return {
    signals: s,
    vision: { format: opts.format === undefined ? 'talking' : opts.format, frames: opts.frames ?? [frame(0), frame(5), frame(10)], model: 'test', failed: [] },
    channel: opts.channel ?? null,
    metadata: { title: opts.title ?? '', hashtags: [] },
    formatOverride: null,
  };
}

function channel(curve: number[]): ChannelContext {
  return {
    videoId: 'abc',
    title: 'x',
    publishedAt: '2026-10-01T00:00:00Z',
    retention: curve.map((pct, sec) => ({ sec, pct })),
    usual: null,
    baselineCount: 0,
    profile: null,
    notes: [],
  };
}

const kinds = (r: ReturnType<typeof analyzeShort>) => r.issues.map((i) => `${i.kind}:${i.level}`);

describe('opening', () => {
  it('marks motion plus early speech as a strong hook', () => {
    expect(kinds(analyzeShort(input(signals(20))))).toContain('strong_hook:good');
  });

  it('marks a still, silent, text-free start as a slow hook', () => {
    const s = signals(20, { moving: (t) => t > 1.6, speech: [{ start: 2, end: 19, text: 'late start' }] });
    const report = analyzeShort(input(s, { frames: [frame(0, { action: false }), frame(5)] }));
    expect(kinds(report)).toContain('slow_hook:bad');
  });
});

describe('stretches', () => {
  it('flags silence + stillness + no speech as a dead zone', () => {
    const quiet = (t: number) => t >= 8 && t < 12;
    const s = signals(20, {
      moving: (t) => !quiet(t),
      loud: (t) => !quiet(t),
      speech: [
        { start: 0.3, end: 8, text: 'a' },
        { start: 12, end: 19, text: 'b' },
      ],
    });
    const report = analyzeShort(input(s, { frames: [frame(0), frame(10, { action: false }), frame(15)] }));
    const dead = report.issues.find((i) => i.kind === 'dead_zone');
    expect(dead).toMatchObject({ level: 'bad', startSec: 8, endSec: 12 });
    expect(report.biggestFixId).toBe(dead?.id);
  });

  const silentAction = () =>
    signals(20, {
      speech: [
        { start: 0.3, end: 6, text: 'a' },
        { start: 12, end: 19, text: 'b' },
      ],
    });

  it('does not flag a silent stretch with action and sound in a process Short', () => {
    const report = analyzeShort(input(silentAction(), { format: 'process' }));
    expect(report.issues.some((i) => i.kind === 'quiet_stretch')).toBe(false);
  });

  it('flags the same stretch in a talking Short', () => {
    expect(kinds(analyzeShort(input(silentAction(), { format: 'talking' })))).toContain('quiet_stretch:warn');
  });

  it('turns the silent process stretch green when retention stays flat', () => {
    const curve = Array.from({ length: 21 }, (_, s) => 100 - s * 1);
    const report = analyzeShort(input(silentAction(), { format: 'process', channel: channel(curve) }));
    expect(kinds(report)).toContain('holds_attention:good');
  });

  it('follows a user correction of the format', () => {
    const base = input(silentAction(), { format: 'process' });
    const report = analyzeShort({ ...base, formatOverride: 'talking' });
    expect(report.format).toBe('talking');
    expect(report.formatSource).toBe('user');
    expect(kinds(report)).toContain('quiet_stretch:warn');
  });
});

describe('retention override', () => {
  const quietSignals = () => {
    const quiet = (t: number) => t >= 8 && t < 12;
    return signals(20, {
      moving: (t) => !quiet(t),
      loud: (t) => !quiet(t),
      speech: [
        { start: 0.3, end: 8, text: 'a' },
        { start: 12, end: 19, text: 'b' },
      ],
    });
  };
  const frames = [frame(0), frame(10, { action: false }), frame(15)];

  it('confirms a dead zone where viewers drop', () => {
    const curve = [100, 92, 88, 86, 85, 84, 83, 82, 81, 75, 69, 63, 58, 57, 56, 55, 54, 53, 52, 51, 50];
    const dead = analyzeShort(input(quietSignals(), { frames, channel: channel(curve) })).issues.find((i) => i.kind === 'dead_zone');
    expect(dead?.level).toBe('bad');
    expect(dead?.evidence.some((e) => e.source === 'retention')).toBe(true);
    expect(dead?.saw).toContain('81% to 58%');
  });

  it('softens a dead zone to yellow when viewers stayed', () => {
    const curve = Array.from({ length: 21 }, (_, s) => 100 - s);
    const dead = analyzeShort(input(quietSignals(), { frames, channel: channel(curve) })).issues.find((i) => i.kind === 'dead_zone');
    expect(dead?.level).toBe('warn');
  });

  it('reports a drop nothing explains', () => {
    const curve = [100, 92, 88, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 70, 62, 55, 54, 53, 52, 51, 50];
    const report = analyzeShort(input(signals(20), { channel: channel(curve) }));
    expect(report.issues.find((i) => i.kind === 'retention_drop')).toMatchObject({ level: 'bad', startSec: 12, endSec: 15 });
  });
});

describe('frozen picture', () => {
  it('does not flag a picture that changes a little every second (an animated map)', () => {
    const s = signals(30, { moving: (t) => t % 1 < 0.25, cuts: [] });
    expect(analyzeShort(input(s, { format: 'tutorial' })).issues.some((i) => i.kind === 'static_shot')).toBe(false);
  });

  it('flags a truly frozen picture', () => {
    const s = signals(30, { moving: (t) => t < 10 || t >= 20, cuts: [] });
    expect(analyzeShort(input(s, { format: 'process' })).issues.find((i) => i.kind === 'static_shot')).toMatchObject({ startSec: 10, endSec: 20 });
  });
});

describe('frame findings', () => {
  it('needs two frames before flagging a watermark', () => {
    const one = analyzeShort(input(signals(20), { frames: [frame(0, { watermark: 'tiktok' }), frame(5)] }));
    const two = analyzeShort(input(signals(20), { frames: [frame(0, { watermark: 'tiktok' }), frame(5, { watermark: 'tiktok' })] }));
    expect(kinds(one)).not.toContain('watermark:bad');
    expect(kinds(two)).toContain('watermark:bad');
  });

  it('flags text in the bottom of the frame when two frames agree', () => {
    const low = { text: 'Hi', textPosition: 'bottom' as const, textSize: 'readable' as const };
    const one = analyzeShort(input(signals(20), { frames: [frame(0), frame(3, low), frame(10)] }));
    const two = analyzeShort(input(signals(20), { frames: [frame(0), frame(3, low), frame(4, low), frame(10)] }));
    expect(kinds(one)).not.toContain('safe_zone:warn');
    expect(two.issues.find((i) => i.kind === 'safe_zone')).toMatchObject({ level: 'warn', startSec: 2.5, endSec: 4.5 });
  });

  it('flags a long tail after the payoff', () => {
    const report = analyzeShort(input(signals(40), { frames: [frame(0), frame(20), frame(30, { showsResult: true }), frame(39)] }));
    expect(report.issues.find((i) => i.kind === 'long_tail')).toMatchObject({ startSec: 30, endSec: 40 });
  });

  it('ignores a result shown in the opening (a teaser, not the payoff)', () => {
    const report = analyzeShort(input(signals(70), { frames: [frame(0), frame(3, { showsResult: true }), frame(30), frame(69)] }));
    expect(report.issues.some((i) => i.kind === 'long_tail')).toBe(false);
  });

  it('lists a finding that covers most of the video instead of drawing it on the timeline', () => {
    const s = signals(70, { moving: (t) => t < 1, cuts: [60] });
    const shot = analyzeShort(input(s)).issues.find((i) => i.kind === 'static_shot');
    expect(shot?.wholeVideo).toBe(true);
  });

  it('flags missing captions in a talking Short', () => {
    const frames = [0, 3, 6, 9, 12, 15].map((t) => frame(t));
    expect(kinds(analyzeShort(input(signals(20), { frames })))).toContain('no_captions:warn');
  });
});

describe('file checks', () => {
  it('flags a horizontal video', () => {
    const s = { ...signals(20), width: 1920, height: 1080 };
    expect(kinds(analyzeShort(input(s)))).toContain('format:warn');
  });

  it('praises a seamless loop', () => {
    const s = { ...signals(20), loopSimilarity: 0.95 };
    expect(kinds(analyzeShort(input(s)))).toContain('loops_well:good');
  });

  it('flags a Bangla voice with an English title', () => {
    const s = { ...signals(20), speechLanguage: 'bn' };
    expect(kinds(analyzeShort(input(s, { title: 'How to cook noodles fast' })))).toContain('language_mismatch:warn');
  });
});

describe('metadata', () => {
  it('asks for hashtags and a topic', () => {
    const report = analyzeShort(input(signals(20), { title: 'Wow' }));
    expect(report.metadataChecks.filter((c) => c.level === 'warn').map((c) => c.id)).toEqual(['topic', 'tags']);
  });
});

describe('against the channel', () => {
  const withProfile = (fit: { score: number; typical: number } | null, topShortDurationSec: number | null = null): ChannelContext => ({
    ...channel([]),
    videoId: null,
    retention: null,
    profile: {
      channelTitle: 'My channel',
      videoCount: 20,
      shortsCount: 12,
      medianShortViews: 900,
      topShortDurationSec,
      fit: fit && { topic: 'Gaming highlights', ...fit, closest: [{ title: 'Easy pasta', views: 1200, similarity: 0.3 }] },
    },
  });

  it('flags a Short far from the channel’s topics, and fixes it first', () => {
    const report = analyzeShort(input(signals(20), { channel: withProfile({ score: 0.3, typical: 0.7 }) }));
    const off = report.issues.find((i) => i.kind === 'off_topic');
    expect(off).toMatchObject({ level: 'bad', wholeVideo: true });
    expect(off?.saw).toContain('Gaming highlights');
    expect(report.biggestFixId).toBe(off?.id);
  });

  it('is yellow when only somewhat off', () => {
    expect(kinds(analyzeShort(input(signals(20), { channel: withProfile({ score: 0.63, typical: 0.7 }) })))).toContain('off_topic:warn');
  });

  it('is green when it fits', () => {
    expect(kinds(analyzeShort(input(signals(20), { channel: withProfile({ score: 0.68, typical: 0.7 }) })))).toContain('channel_fit:good');
  });

  it('flags a Short much longer than the channel’s better Shorts', () => {
    expect(kinds(analyzeShort(input(signals(60), { channel: withProfile(null, 25) })))).toContain('longer_than_usual:warn');
    expect(kinds(analyzeShort(input(signals(30), { channel: withProfile(null, 25) })))).not.toContain('longer_than_usual:warn');
  });

  it('notes the usual Short’s opening before publishing', () => {
    const ctx = { ...withProfile(null), usual: [100, 80, 70, 65].map((pct, sec) => ({ sec, pct })) };
    const hook = analyzeShort(input(signals(20), { channel: ctx })).issues.find((i) => i.kind === 'strong_hook');
    expect(hook?.saw).toContain('your usual Short keeps 70%');
  });
});
