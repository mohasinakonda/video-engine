import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVideoDaily, fetchVideoShape, fetchVideoStatus, formatFromShape } from './fetch';
import { videoRange } from './period';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchVideoStatus', () => {
  it('maps status and restrictions, and treats missing fields as unknown', async () => {
    stubFetch({
      items: [
        {
          id: 'a',
          status: { uploadStatus: 'rejected', rejectionReason: 'duplicate', privacyStatus: 'public', madeForKids: false },
          contentDetails: { regionRestriction: { allowed: [] }, contentRating: { ytRating: 'ytAgeRestricted' } },
        },
        { id: 'b' },
      ],
    });
    const result = await fetchVideoStatus('token', ['a', 'b']);
    expect(result.a).toEqual({
      uploadStatus: 'rejected',
      failureReason: null,
      rejectionReason: 'duplicate',
      privacyStatus: 'public',
      madeForKids: false,
      regionAllowed: [],
      regionBlocked: null,
      ageRestricted: true,
      publishAt: null,
    });
    expect(result.b.uploadStatus).toBeNull();
    expect(result.b.ageRestricted).toBe(false);
  });

  it('asks for 50 videos per request', async () => {
    const fetchMock = stubFetch({ items: [] });
    await fetchVideoStatus('token', Array.from({ length: 51 }, (_, i) => `v${i}`));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('formatFromShape (a video with no views, so no creatorContentType)', () => {
  const vertical = { width: 1080, height: 1920 };
  const horizontal = { width: 1920, height: 1080 };

  it('a 1-minute vertical video is a Short', () => {
    expect(formatFromShape(60, vertical)).toBe('short');
  });
  it('a 1-minute horizontal video is a long video', () => {
    expect(formatFromShape(60, horizontal)).toBe('video');
  });
  it('a square video up to 3 minutes is a Short', () => {
    expect(formatFromShape(180, { width: 1080, height: 1080 })).toBe('short');
  });
  it('over 3 minutes is a long video, even vertical', () => {
    expect(formatFromShape(181, vertical)).toBe('video');
  });
  it('unknown frame or length can’t be told', () => {
    expect(formatFromShape(60, undefined)).toBeNull();
    expect(formatFromShape(null, vertical)).toBeNull();
  });
});

describe('fetchVideoShape', () => {
  it('reads the frame, turns rotated videos, and skips videos not measured yet', async () => {
    stubFetch({
      items: [
        { id: 'a', fileDetails: { videoStreams: [{ widthPixels: 1080, heightPixels: 1920, rotation: 'none' }] } },
        { id: 'b', fileDetails: { videoStreams: [{ widthPixels: 1920, heightPixels: 1080, rotation: 'clockwise' }] } },
        { id: 'c', fileDetails: {} },
      ],
    });
    const result = await fetchVideoShape('token', ['a', 'b', 'c']);
    expect(result.a).toEqual({ width: 1080, height: 1920 });
    expect(result.b).toEqual({ width: 1080, height: 1920 });
    expect(result.c).toBeUndefined();
  });
});

describe('fetchVideoDaily', () => {
  it('returns views, engaged views, reactions and % viewed per day', async () => {
    const bodies = [
      {
        columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'engagedViews' }],
        rows: [
          ['2026-10-01', 500, 320],
          ['2026-10-02', 40, 20],
        ],
      },
      {
        columnHeaders: [{ name: 'day' }, { name: 'likes' }, { name: 'comments' }, { name: 'shares' }, { name: 'averageViewPercentage' }],
        rows: [['2026-10-01', 12, 2, 1, 71.5]],
      },
    ];
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(bodies[call++]), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const days = await fetchVideoDaily('token', { startDate: '2026-10-01', endDate: '2026-10-02', days: 2 }, 'a');
    expect(days).toEqual([
      { date: '2026-10-01', views: 500, engagedViews: 320, likes: 12, comments: 2, shares: 1, avgViewPct: 71.5 },
      { date: '2026-10-02', views: 40, engagedViews: 20 },
    ]);
  });
});

describe('videoRange', () => {
  const period = { startDate: '2026-08-03', endDate: '2026-10-31', days: 90 };

  it('starts on the publish day inside the period', () => {
    expect(videoRange('2026-10-29T12:00:00Z', period)).toEqual({ startDate: '2026-10-29', endDate: '2026-10-31', days: 3 });
  });

  it('starts on the period start for older videos', () => {
    expect(videoRange('2026-01-01T00:00:00Z', period)).toEqual(period);
  });

  it('is null for videos newer than the last reported day', () => {
    expect(videoRange('2026-11-02T00:00:00Z', period)).toBeNull();
  });
});
