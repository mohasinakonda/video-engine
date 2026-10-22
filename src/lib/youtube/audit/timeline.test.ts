import { describe, expect, it, vi } from 'vitest';
import type { RetentionAnomaly } from '../types';
import { linesAtDrops, parseTimedTranscript, spreadPlainTranscript, transcriptCues } from './timeline';

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
vi.mock('./fetch', () => ({
  fetchAuditVideo: async () => ({
    id: 'v', channelId: 'c', channelTitle: '', title: 'A very long title that keeps going past the point where YouTube cuts it off',
    description: '', tags: [], publishedAt: '2026-09-01T00:00:00Z', durationSec: 600, thumbnailUrl: null, views: 100, likes: 1, comments: 0, liveOrUpcoming: false, madeForKids: false, wasStreamed: false,
  }),
  fetchCommentTexts: async () => ({ texts: [], available: true, disabled: true }),
}));
vi.mock('./ai/comments', async (o) => ({ ...(await o<typeof import('./ai/comments')>()), viewerThemes: async () => null }));

import { ownVideoExtras } from './own-video';

describe('own video extras', () => {
  const base = { accessToken: 't', videoId: 'v', title: 'A very long title that keeps going past the point where YouTube cuts it off', thumbnail: null, maxComments: 100, textModels: [] };

  it('adds packaging rules without performance, and notes disabled comments', async () => {
    const x = await ownVideoExtras(base);
    expect(x.packaging.map((f) => f.area)).toEqual(expect.arrayContaining(['title', 'metadata']));
    expect(x.packaging.some((f) => f.area === 'performance')).toBe(false);
    expect(x.limitations).toContain('Comments are turned off on this video.');
  });
});
