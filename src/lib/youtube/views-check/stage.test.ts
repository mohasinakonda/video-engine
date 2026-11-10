import { describe, expect, it } from 'vitest';
import type { VideoMeta } from '../types';
import { channelStage } from './stage';

const NOW = new Date('2026-11-08T12:00:00Z');

/** A Short published `daysAgo` days before NOW with `views` public views. */
const short = (i: number, daysAgo: number, views: number): VideoMeta => ({
  id: `v${i}`,
  title: `Short ${i}`,
  publishedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  durationSec: 25,
  thumbnailUrl: null,
  format: 'short',
  lifetimeViews: views,
  likes: 0,
  comments: 0,
});

const channel = { subscriberCount: 3, createdAt: '2026-10-13T10:25:24Z' };

describe('channel stage', () => {
  it('sees a rising floor on Detail Dose’s real numbers (8 Nov 2026)', () => {
    // Newest first; the 1-day and same-day Shorts are too young to compare.
    const shorts = [
      short(1, 0, 358),
      short(2, 1, 1159),
      short(3, 2, 1135),
      short(4, 3, 739),
      short(5, 14, 972),
      short(6, 15, 63),
      short(7, 17, 103),
      short(8, 18, 672),
      short(9, 19, 2117),
    ];
    const stage = channelStage(shorts, [], channel, NOW);
    expect(stage.id).toBe('finding_audience');
    expect(stage.recent).toMatchObject({ count: 3, floorViews: 739, medianViews: 972 });
    expect(stage.previous).toMatchObject({ count: 3, floorViews: 63, medianViews: 103 });
    expect(stage.channelAgeDays).toBe(26);
    expect(stage.detail).toMatch(/at least 739 views/);
  });

  it('needs enough Shorts that are a few days old', () => {
    const stage = channelStage([short(1, 5, 100), short(2, 6, 200), short(3, 1, 900)], [], channel, NOW);
    expect(stage.id).toBe('not_enough');
    expect(stage.recent).toBeNull();
  });

  it('reads big swings with no trend as still being tested', () => {
    // Newest three 50 / 4,000 / 300 vs 120 / 90 / 2,500: no clear trend, huge swings.
    const views = [50, 4000, 300, 120, 90, 2500];
    const stage = channelStage(views.map((v, i) => short(i, 3 + i, v)), [], channel, NOW);
    expect(stage.id).toBe('testing');
  });

  it('flags a clear drop', () => {
    const views = [100, 120, 90, 900, 1000, 800];
    expect(channelStage(views.map((v, i) => short(i, 3 + i, v)), [], channel, NOW).id).toBe('slowing');
  });

  it('calls similar numbers steady', () => {
    const views = [500, 600, 550, 520, 580, 610];
    expect(channelStage(views.map((v, i) => short(i, 3 + i, v)), [], channel, NOW).id).toBe('steady');
  });

  it('mentions a growing Shorts-feed share when it is known', () => {
    const views = [900, 1000, 950, 100, 120, 90];
    const shorts = views.map((v, i) => short(i, 3 + i, v));
    const timelines = shorts.map((s, i) => ({ videoId: s.id, shortsFeedShare: i < 3 ? 0.8 : 0.4 })) as never;
    expect(channelStage(shorts, timelines, channel, NOW).detail).toMatch(/80%, up from 40%/);
  });
});
