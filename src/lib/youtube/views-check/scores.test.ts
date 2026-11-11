import { describe, expect, it } from 'vitest';
import { accountHealth } from './account-health';
import { distributionScore } from './distribution-score';
import type { ChannelSignal, GrowthOutlook, ShortTimeline, VideoFinding, VideoStatus, ViewsCause } from './types';

const finding = (i: number, cause: ViewsCause = 'ok'): VideoFinding =>
  ({
    videoId: `v${i}`,
    title: `Short ${i}`,
    format: 'short',
    cause,
  }) as VideoFinding;
const timeline = (feed: number | null): ShortTimeline => ({ shortsFeedShare: feed }) as ShortTimeline;
const reach = (change: number | null, state: GrowthOutlook['reach']['state'] = 'flat'): GrowthOutlook['reach'] => ({
  state,
  by: 'views',
  change,
  recent: { count: 5, medianViews: 0, medianFirstDay: null, zeroViewShare: 0 },
  previous: {
    count: 5,
    medianViews: 0,
    medianFirstDay: null,
    zeroViewShare: 0,
  },
});

describe('distribution score', () => {
  it('scores 70 when every part sits on its healthy line', () => {
    // 9 of 10 shown = 90%, the same reach as before, 70% from the feed.
    const d = distributionScore([...Array.from({ length: 9 }, (_, i) => finding(i)), finding(9, 'not_shown')], [0.7, 0.7, 0.7].map(timeline), reach(1));
    expect(d.parts.map((p) => p.score)).toEqual([70, 70, 70]);
    expect(d.score).toBe(70);
    expect(d.band).toBe('healthy');
  });

  it('names the part that costs the most', () => {
    const half = Array.from({ length: 10 }, (_, i) => finding(i, i % 2 ? 'not_in_feed' : 'ok'));
    const d = distributionScore(half, [0.9, 0.9, 0.9].map(timeline), reach(1.2, 'rising'));
    expect(d.headline).toMatch(/keeping some of your Shorts out of the feed/);
    expect(d.detail).toMatch(/^5 of your last 10 Shorts reached the Shorts feed/);
  });

  it('leaves blocked and too-new Shorts out, and parts without data', () => {
    const d = distributionScore([finding(0), finding(1), finding(2), finding(3, 'blocked'), finding(4, 'too_new')], [], reach(null, 'unknown'));
    expect(d.shorts).toBe(3);
    expect(d.parts.map((p) => p.id)).toEqual(['shown']);
    expect(d.score).toBe(78); // 100% shown: 70 × 1 ÷ 0.9
  });

  it('has no score with fewer than 3 judged Shorts', () => {
    expect(distributionScore([finding(0), finding(1)], [], reach(1)).score).toBeNull();
  });
});

const ok: VideoStatus = {
  uploadStatus: 'processed',
  failureReason: null,
  rejectionReason: null,
  privacyStatus: 'public',
  madeForKids: false,
  regionAllowed: null,
  regionBlocked: null,
  ageRestricted: false,
};
const video = (i: number, status: Partial<VideoStatus> = {}) => ({
  videoId: `v${i}`,
  title: `Video ${i}`,
  status: { ...ok, ...status },
});
const signal = (id: ChannelSignal['id'], severity: ChannelSignal['severity'] = 'medium'): ChannelSignal => ({ id, severity, title: id, detail: '', fix: '' });
const base = {
  statusRead: true,
  mainCountries: ['US', 'IN', 'GB'],
  kidsChannel: false,
  signals: [] as ChannelSignal[],
};

describe('account health', () => {
  it('is 100 with nothing wrong', () => {
    const a = accountHealth({ ...base, videos: [video(0), video(1)] });
    expect(a.score).toBe(100);
    expect(a.headline).toBe('No strike, block or restriction found. Your channel is fine.');
  });

  it('takes points off per problem, capped per kind, worst first', () => {
    const a = accountHealth({
      ...base,
      videos: [video(0, { regionAllowed: [] }), video(1, { regionBlocked: ['US'] }), video(2, { regionBlocked: ['FR'] }), video(3, { uploadStatus: 'rejected' })],
      signals: [signal('not_verified'), signal('sudden_drop', 'high')],
    });
    // copyright 15 + rejected 15 + not verified 10 + main-country 8 + other country 2; sudden_drop isn't an account problem.
    expect(a.issues.map((i) => i.id)).toEqual(['copyright_block', 'rejected', 'not_verified', 'main_country_block', 'country_block']);
    expect(a.score).toBe(50);
    expect(a.headline).toMatch(/^Videos blocked everywhere/);
    const many = accountHealth({
      ...base,
      videos: Array.from({ length: 6 }, (_, i) => video(i, { regionAllowed: [] })),
    });
    expect(many.score).toBe(55);
  });

  it('ignores private, scheduled and processing videos; flags kids only on a non-kids channel', () => {
    const videos = [video(0, { privacyStatus: 'private' }), video(1, { uploadStatus: 'uploaded' }), video(2, { madeForKids: true })];
    expect(accountHealth({ ...base, videos }).issues.map((i) => i.id)).toEqual(['made_for_kids']);
    expect(accountHealth({ ...base, kidsChannel: true, videos }).score).toBe(100);
  });

  it('has no score when the status couldn’t be read', () => {
    expect(accountHealth({ ...base, statusRead: false, videos: [] }).score).toBeNull();
  });
});
