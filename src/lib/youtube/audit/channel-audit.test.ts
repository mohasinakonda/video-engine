import { describe, expect, it } from 'vitest';
import type { ThumbnailFindings } from '../analysis/thumbnails';
import type { MarketVideo, PublicChannel } from '../discover/types';
import { SYSTEM_CHANNEL, SYSTEM_VIDEO } from './ai/lessons';
import { auditChannel, rankVideos, thumbnailSplit } from './channel-audit';

const NOW = new Date('2026-10-20T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const CHANNEL: PublicChannel = { id: 'UC' + 'c'.repeat(22), title: 'Theirs', thumbnail: null, url: '', subscriberCount: 1000, videoCount: 40 };

let n = 0;
const v = (over: Partial<MarketVideo> = {}): MarketVideo => ({
  id: `vid${String(++n).padStart(8, '0')}`,
  channelId: CHANNEL.id,
  title: `Plain title ${n}`,
  publishedAt: daysAgo(10 + n),
  durationSec: 600,
  views: 1000,
  likes: 10,
  comments: 1,
  thumbnailUrl: null,
  ...over,
});

/** 14 usual videos, 3 standouts with "why" titles and 3 weak ones with "how" titles. */
const channelVideos = () => [
  ...Array.from({ length: 14 }, () => v()),
  ...Array.from({ length: 3 }, (_, i) => v({ title: `Why the ocean glows ${i}`, views: 9000 })),
  ...Array.from({ length: 3 }, (_, i) => v({ title: `How to tie knots ${i}`, views: 200 })),
];

describe('channel audit', () => {
  it('ranks videos against the channel’s own usual', () => {
    const ranked = rankVideos(channelVideos(), NOW);
    expect(ranked[0].ratio).toBe(9);
    expect(ranked.at(-1)!.ratio).toBe(0.2);
  });

  it('finds what separates standouts from weak videos, and counts the hit rate', () => {
    const r = auditChannel(CHANNEL, channelVideos(), NOW);
    expect(r.stats).toMatchObject({ judged: 20, standouts: 3, weak: 3, hitRate: 0.15 });
    const titles = r.findings.filter((f) => f.area === 'title').map((f) => `${f.kind}:${f.statement}`);
    expect(titles).toContain('strength:Its standouts use “why…” far more than its weakest videos.');
    expect(titles).toContain('weakness:Its weakest videos use “how…” far more than its standouts.');
    expect(r.findings.find((f) => f.area === 'performance')?.statement).toContain('often');
  });

  it('says when it can’t read patterns, and flags a channel that stopped uploading', () => {
    const few = auditChannel(CHANNEL, [v(), v()], NOW);
    expect(few.limitations[0]).toContain('can’t be read yet');
    const quiet = auditChannel(CHANNEL, channelVideos().map((x) => ({ ...x, publishedAt: daysAgo(60 + Number(x.id.slice(-3))) })), NOW);
    expect(quiet.findings.some((f) => f.area === 'rhythm' && f.kind === 'weakness')).toBe(true);
  });

  it('compares with your channel when it’s given', () => {
    const mine = Array.from({ length: 10 }, (_, i) => v({ title: `How I did ${i}`, durationSec: 40, publishedAt: daysAgo(5 + i) }));
    const r = auditChannel(CHANNEL, channelVideos(), NOW, mine);
    const lines = r.findings.filter((f) => f.area === 'comparison').map((f) => f.statement);
    expect(lines.some((l) => l.includes('of your last 10 titles use it'))).toBe(true);
    expect(lines.some((l) => l.includes('Shorts'))).toBe(true);
  });
});

describe('thumbnail split', () => {
  const t = (over: Partial<ThumbnailFindings> = {}): ThumbnailFindings => ({
    subject: 's', subjectSizePct: 60, faceVisible: false, textOnImage: 'Big', wordCount: 1, contrast: 'high', background: 'simple', readableAtSmallSize: true, ...over,
  });

  it('needs 3 on each side and a clear difference', () => {
    expect(thumbnailSplit([t(), t()], [t(), t()])).toEqual([]);
    const out = thumbnailSplit([t(), t(), t()], [t({ wordCount: 0, textOnImage: null }), t({ wordCount: 0, textOnImage: null }), t({ wordCount: 0, textOnImage: null })]);
    expect(out.map((f) => f.id)).toEqual(['thumbnail_text', 'thumbnail_short_text']);
    expect(out.every((f) => f.confidence === 'low')).toBe(true);
  });
});

describe('channel lessons prompt', () => {
  it('is adapted from the video prompt, asking for things to test, not rules', () => {
    expect(SYSTEM_CHANNEL).not.toBe(SYSTEM_VIDEO);
    expect(SYSTEM_CHANNEL).toContain('channel audit');
    expect(SYSTEM_CHANNEL).toContain('never as a rule');
    expect(SYSTEM_CHANNEL).toContain('what makes this channel work');
  });
});
