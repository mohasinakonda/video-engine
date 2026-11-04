import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVideoDaily, fetchVideoStatus } from './fetch';
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

describe('fetchVideoDaily', () => {
  it('returns views and engaged views per day', async () => {
    stubFetch({
      columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'engagedViews' }],
      rows: [
        ['2026-10-01', 500, 320],
        ['2026-10-02', 40, 20],
      ],
    });
    const days = await fetchVideoDaily('token', { startDate: '2026-10-01', endDate: '2026-10-02', days: 2 }, 'a');
    expect(days).toEqual([
      { date: '2026-10-01', views: 500, engagedViews: 320 },
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
