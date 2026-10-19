import {
  fetchDaily,
  fetchFormatViews,
  fetchPerVideo,
  fetchRetention,
  fetchTotals,
  fetchTraffic,
} from './analytics-client';
import { getPeriods } from './analysis/period';
import { updateReportingJob, type PublicConnection } from './connection-service';
import { fetchMyChannels, fetchUploadIds, fetchVideoDetails } from './data-client';
import { GoogleApiError } from './google-fetch';
import { ensureReachJob, fetchReach } from './reporting-client';
import type { ChannelDoctorSettings } from './settings';
import type { ChannelDataset, DiagnosisStage, PeriodStats, RangeKey, Result } from './types';

export class ChannelMismatchError extends Error {
  constructor() {
    super('The connected Google account no longer returns this channel. Please reconnect YouTube.');
  }
}

/** Runs `fn` over items with at most `limit` in flight, keeping order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Turns an optional data source's failure into a reason the report can show. */
export async function settle<T>(promise: Promise<T>, label: string): Promise<Result<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (err) {
    return { ok: false, reason: describeFailure(err, label) };
  }
}

function describeFailure(err: unknown, label: string): string {
  if (err instanceof GoogleApiError) {
    switch (err.kind) {
      case 'quota':
        return `${label} could not be loaded because the YouTube API limit was reached. Try again later.`;
      case 'bad_request':
        return `YouTube does not provide ${label} for this channel or period.`;
      case 'forbidden':
        return `YouTube did not allow access to ${label}.`;
      case 'auth':
        return `YouTube authorization failed while loading ${label}.`;
      case 'network':
      case 'unavailable':
        return `${label} could not be loaded because YouTube did not respond.`;
      default:
        return `${label} is not available.`;
    }
  }
  return `${label} could not be loaded.`;
}

interface FetchOptions {
  userId: string;
  accessToken: string;
  connection: PublicConnection;
  reportingJobId: string | null;
  settings: ChannelDoctorSettings;
  range: RangeKey;
  onStage: (stage: DiagnosisStage) => void;
}

/**
 * Collects everything the diagnosis needs, in memory only. Required data (channel and
 * uploads) throws on failure; every analytics source is optional and becomes a Result.
 */
export async function fetchChannelDataset(options: FetchOptions): Promise<ChannelDataset> {
  const { userId, accessToken, connection, settings, range, onStage } = options;
  const { current, previous } = getPeriods(range);

  onStage('fetch_channel');
  const channel = (await fetchMyChannels(accessToken)).find((c) => c.id === connection.channelId);
  if (!channel) throw new ChannelMismatchError();
  const uploadIds = channel.uploadsPlaylistId
    ? await fetchUploadIds(accessToken, channel.uploadsPlaylistId, settings.maxVideos)
    : [];
  const videos = await fetchVideoDetails(accessToken, uploadIds);

  onStage('fetch_analytics');
  // The reach job may be missing if it failed at connect time; create it now for future runs.
  let jobId = options.reportingJobId;
  let jobCreatedAt = connection.reportingStartedAt;
  if (!jobId) {
    try {
      const job = await ensureReachJob(accessToken);
      await updateReportingJob(userId, job);
      jobId = job.id;
      jobCreatedAt = job.createdAt;
    } catch {
      // reported below as unavailable reach data
    }
  }

  const [daily, totals, previousTotals, shorts, longForm, traffic, formatViews, reach] = await Promise.all([
    settle(fetchDaily(accessToken, current), 'daily trends'),
    settle(fetchTotals(accessToken, current), 'channel totals').then(nullToMissing('channel totals')),
    settle(fetchTotals(accessToken, previous), 'previous-period totals').then(nullToMissing('previous-period totals')),
    settle(fetchPerVideo(accessToken, current, 'short'), 'Shorts performance'),
    settle(fetchPerVideo(accessToken, current, 'video'), 'video performance'),
    settle(fetchTraffic(accessToken, current), 'traffic sources'),
    settle(fetchFormatViews(accessToken, current), 'Shorts vs videos split'),
    jobId
      ? settle(fetchReach(accessToken, jobId, jobCreatedAt, current), 'impressions and CTR')
      : Promise.resolve<Result<never>>({ ok: false, reason: 'Impressions and CTR reporting could not be started for this channel.' }),
  ]);

  // The per-video report filtered by content type tells us each video's format.
  const perVideoMap: Record<string, PeriodStats> = {};
  if (shorts.ok) {
    for (const [id, stats] of Object.entries(shorts.data)) perVideoMap[id] = stats;
  }
  if (longForm.ok) {
    for (const [id, stats] of Object.entries(longForm.data)) perVideoMap[id] = stats;
  }
  for (const video of videos) {
    if (shorts.ok && shorts.data[video.id]) video.format = 'short';
    else if (longForm.ok && longForm.data[video.id]) video.format = 'video';
  }
  const perVideo: Result<Record<string, PeriodStats>> =
    shorts.ok || longForm.ok
      ? { ok: true, data: perVideoMap }
      : { ok: false, reason: (longForm as { reason: string }).reason };

  onStage('retention');
  // Retention for the most-watched regular videos (Shorts retention behaves differently).
  const retentionIds = videos
    .filter((v) => v.format === 'video' && (perVideoMap[v.id]?.views ?? 0) > 0)
    .sort((a, b) => (perVideoMap[b.id]?.views ?? 0) - (perVideoMap[a.id]?.views ?? 0))
    .slice(0, settings.maxRetentionVideos)
    .map((v) => v.id);
  const retentionResults = await mapLimit(retentionIds, 4, (id) =>
    settle(fetchRetention(accessToken, current, id), 'audience retention')
  );
  const retention = Object.fromEntries(retentionIds.map((id, i) => [id, retentionResults[i]]));

  return {
    range,
    current,
    previous,
    channel: {
      id: channel.id,
      title: channel.title,
      thumbnail: channel.thumbnail,
      url: channel.url,
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
    },
    videos,
    daily,
    totals,
    previousTotals,
    perVideo,
    traffic,
    formatViews,
    retention,
    reach,
  };
}

function nullToMissing<T>(label: string) {
  return (result: Result<T | null>): Result<T> =>
    result.ok
      ? result.data === null
        ? { ok: false, reason: `YouTube returned no ${label} for this period.` }
        : { ok: true, data: result.data }
      : result;
}
