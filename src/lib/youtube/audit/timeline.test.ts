import { describe, expect, it, vi } from 'vitest';
import type { RetentionAnomaly, RetentionPoint } from '../types';
import { linesAtDrops, parseTimedTranscript, scriptTimeline, spreadPlainTranscript, transcriptCues, watchAt } from './timeline';

// 100% at the start, a steep fall to 60% by 20%, then a slow slide to 40%.
const curve: RetentionPoint[] = [
  { ratio: 0, watchRatio: 1, relativePerformance: null },
  { ratio: 0.2, watchRatio: 0.6, relativePerformance: null },
  { ratio: 1, watchRatio: 0.4, relativePerformance: null },
];

describe('retention on the script', () => {
  it('interpolates the curve', () => {
    expect(watchAt(curve, 0.1)).toBeCloseTo(0.8);
    expect(watchAt(curve, 0.6)).toBeCloseTo(0.5);
    expect(watchAt([], 0.5)).toBeNull();
  });

  it('times parts by their words and finds the one that lost the most', () => {
    const t = scriptTimeline(curve, 600, [
      { id: 'hook', heading: 'Hook', words: 20 },
      { id: 'part1', heading: 'Part 1', words: 40 },
      { id: 'cta', heading: 'Close', words: 40 },
    ])!;
    expect(t.parts.map((p) => [p.startSec, p.endSec])).toEqual([
      [0, 120],
      [120, 360],
      [360, 600],
    ]);
    expect(t.parts[0]).toMatchObject({ startPct: 100, endPct: 60, dropPts: 40 });
    expect(t.worstId).toBe('hook');
    expect(scriptTimeline(curve, 600, [])).toBeNull();
  });
});

describe('pasted transcripts', () => {
  const srt = `1
00:00:00,000 --> 00:00:05,000
Welcome back to the channel.

2
00:00:05,000 --> 00:00:30,500
Before we start, a word from our sponsor.

3
00:01:10,000 --> 00:01:15,000
<i>Now the real story.</i>`;

  it('reads SRT and VTT cues, dropping tags', () => {
    expect(parseTimedTranscript(srt)).toEqual([
      { startSec: 0, text: 'Welcome back to the channel.' },
      { startSec: 5, text: 'Before we start, a word from our sponsor.' },
      { startSec: 70, text: 'Now the real story.' },
    ]);
    const vtt = 'WEBVTT\n\n00:00.000 --> 00:02.000\nHi\n\n00:02.000 --> 00:05.000\nThere\n\n00:05.000 --> 00:09.000\nFriend';
    expect(parseTimedTranscript(vtt).map((c) => c.startSec)).toEqual([0, 2, 5]);
  });

  it('spreads plain text by word count, and says it isn’t timed', () => {
    expect(spreadPlainTranscript('One two. Three four.', 100)).toEqual([
      { startSec: 0, text: 'One two.' },
      { startSec: 50, text: 'Three four.' },
    ]);
    expect(transcriptCues('Just one plain sentence here.', 60).timed).toBe(false);
    expect(transcriptCues(srt, 120).timed).toBe(true);
  });

  it('shows what was said at each drop, including the line before', () => {
    const drop: RetentionAnomaly = { videoId: 'v', kind: 'steep_drop', atSec: 20, atRatio: 0.2, magnitude: 18, severity: 'major', confidence: 'medium' };
    const spike: RetentionAnomaly = { ...drop, kind: 'rewatch_spike', atSec: 80 };
    const lines = linesAtDrops(parseTimedTranscript(srt), [drop, spike], 120);
    expect(lines).toEqual([{ atSec: 20, kind: 'steep_drop', magnitude: 18, text: 'Welcome back to the channel. Before we start, a word from our sponsor.' }]);
  });
});

// ─── Own-video extras (mocked I/O) ───────────────────────────────────────────
const io = { linked: null as { projectId: string; script: unknown } | null };
vi.mock('./fetch', () => ({
  fetchAuditVideo: async () => ({
    id: 'v', channelId: 'c', channelTitle: '', title: 'A very long title that keeps going past the point where YouTube cuts it off',
    description: '', tags: [], publishedAt: '2026-09-01T00:00:00Z', durationSec: 600, thumbnailUrl: null, views: 100, likes: 1, comments: 0, liveOrUpcoming: false,
  }),
  fetchCommentTexts: async () => ({ texts: [], available: true, disabled: true }),
}));
vi.mock('../create/published-videos', () => ({ scriptForVideo: async () => io.linked }));
vi.mock('./ai/comments', async (o) => ({ ...(await o<typeof import('./ai/comments')>()), viewerThemes: async () => null }));

import { emptyBrief } from '../create/brief';
import { emptyScript } from '../create/script';
import { ownVideoExtras } from './own-video';

describe('own video extras', () => {
  const base = { userId: 'u', accessToken: 't', videoId: 'v', title: 'A very long title that keeps going past the point where YouTube cuts it off', durationSec: 600, thumbnail: null, retention: curve, maxComments: 100, textModels: [] };

  it('adds packaging rules without performance, and notes disabled comments', async () => {
    io.linked = null;
    const x = await ownVideoExtras(base);
    expect(x.packaging.map((f) => f.area)).toEqual(expect.arrayContaining(['title', 'metadata']));
    expect(x.packaging.some((f) => f.area === 'performance')).toBe(false);
    expect(x.limitations).toContain('Comments are turned off on this video.');
    expect(x.script).toBeNull();
  });

  it('times retention on the script of a linked Create video', async () => {
    const script = emptyScript(emptyBrief('Deep sea', 'English'), 8);
    script.sections.forEach((s) => (s.narration = 'word '.repeat(50).trim()));
    io.linked = { projectId: 'p1', script };
    const x = await ownVideoExtras(base);
    expect(x.script?.projectId).toBe('p1');
    expect(x.script?.timeline.parts).toHaveLength(script.sections.length);
    expect(x.script?.timeline.worstId).toBe(script.sections[0].id);
  });
});
