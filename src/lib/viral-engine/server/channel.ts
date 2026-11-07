/**
 * Channel data for the Viral Engine, whenever the channel is connected:
 * - the channel's recent uploads (to compare topic and length) and its "usual Short" retention;
 * - with a linked published Short, that Short's own retention per second.
 * Read for this request only, never stored.
 */
import { fetchPerVideo, fetchRetention } from '@/lib/youtube/analytics-client';
import { DATA_LAG_DAYS, getPeriods } from '@/lib/youtube/analysis/period';
import type { PublicConnection } from '@/lib/youtube/connection-service';
import { fetchMyChannels, fetchUploadIds, fetchVideoChannelId, fetchVideoDetails } from '@/lib/youtube/data-client';
import { ChannelMismatchError, mapLimit, settle } from '@/lib/youtube/fetcher';
import type { DateRange, VideoMeta } from '@/lib/youtube/types';
import { VideoNotOwnedError } from '@/lib/youtube/video-analysis';
import { normalizeRetention, usualCurve } from '../retention';
import { RULES } from '../rules-config';
import { median } from '../signals';
import type { ChannelContext, ChannelProfile, RetentionPoint } from '../types';

const DAY_MS = 86_400_000;
/** Analytics needs a few days before a new video's retention is complete. */
const MIN_AGE_DAYS = DATA_LAG_DAYS;
/** Seconds the file and the published video may differ before we refuse to overlay retention. */
const DURATION_TOLERANCE_SEC = 1.5;
/** Recent uploads read to describe the channel. */
const RECENT_UPLOADS = 50;

interface Options {
  accessToken: string;
  connection: PublicConnection;
  /** A linked, published Short; null for a check before publishing. */
  videoId: string | null;
  /** Duration of the uploaded file. */
  durationSec: number;
  maxBaselineShorts: number;
  now?: Date;
}

export interface ChannelData {
  /** `profile.fit` is filled later, once this Short's topic is known. */
  context: ChannelContext;
  /** Recent uploads (not this Short) for the topic comparison. */
  uploads: { title: string; views: number | null }[];
}

/** From the publish day to the last fully reported day; null when the video is too new. */
function lifetimeRange(publishedAt: string, now: Date): DateRange | null {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DATA_LAG_DAYS * DAY_MS;
  const start = Date.parse(publishedAt.slice(0, 10));
  if (!Number.isFinite(start) || start > end) return null;
  return {
    startDate: new Date(start).toISOString().slice(0, 10),
    endDate: new Date(end).toISOString().slice(0, 10),
    days: Math.floor((end - start) / DAY_MS) + 1,
  };
}

const ageDays = (publishedAt: string, now: Date) => (now.getTime() - Date.parse(publishedAt)) / DAY_MS;

async function curveFor(accessToken: string, video: VideoMeta, durationSec: number, now: Date): Promise<RetentionPoint[]> {
  const range = lifetimeRange(video.publishedAt, now);
  if (!range) return [];
  return normalizeRetention(await fetchRetention(accessToken, range, video.id), durationSec);
}

export async function fetchChannelData(options: Options): Promise<ChannelData> {
  const { accessToken, connection, videoId, durationSec } = options;
  const now = options.now ?? new Date();
  const notes: string[] = [];

  // A linked Short must belong to the connected channel (checked before anything else is read).
  let linked: VideoMeta | null = null;
  if (videoId) {
    if ((await fetchVideoChannelId(accessToken, videoId)) !== connection.channelId) throw new VideoNotOwnedError();
    [linked] = await fetchVideoDetails(accessToken, [videoId]);
    if (!linked) throw new VideoNotOwnedError();
  }

  const loaded = await settle(
    (async () => {
      const channel = (await fetchMyChannels(accessToken)).find((c) => c.id === connection.channelId);
      if (!channel) throw new ChannelMismatchError();
      const ids = channel.uploadsPlaylistId ? await fetchUploadIds(accessToken, channel.uploadsPlaylistId, RECENT_UPLOADS) : [];
      const details = (await fetchVideoDetails(accessToken, ids)).filter((v) => v.id !== videoId && !v.liveOrUpcoming);
      const shortIds = await settle(fetchPerVideo(accessToken, getPeriods('90d', now).current, 'short'), 'Shorts list');
      // Without Analytics' Shorts list, a video up to 3 minutes is treated as a Short.
      const isShort = (v: VideoMeta) => (shortIds.ok ? v.id in shortIds.data : (v.durationSec ?? 999) <= RULES.maxDurationSec);
      return { title: channel.title, details, shorts: details.filter(isShort) };
    })(),
    'your channel’s recent uploads'
  );

  let profile: ChannelProfile | null = null;
  let usual: RetentionPoint[] | null = null;
  let baselineCount = 0;
  let uploads: ChannelData['uploads'] = [];

  if (!loaded.ok) {
    notes.push(loaded.reason);
  } else {
    const { title, details, shorts } = loaded.data;
    uploads = details.map((v) => ({ title: v.title, views: v.lifetimeViews }));
    const withViews = shorts.filter((v) => v.lifetimeViews !== null && v.durationSec);
    const better = [...withViews].sort((a, b) => (b.lifetimeViews as number) - (a.lifetimeViews as number)).slice(0, Math.ceil(withViews.length / 2));
    profile = {
      channelTitle: title,
      videoCount: details.length,
      shortsCount: shorts.length,
      medianShortViews: median(withViews.map((v) => v.lifetimeViews as number)),
      topShortDurationSec: withViews.length >= RULES.minShortsForLength ? median(better.map((v) => v.durationSec as number)) : null,
      fit: null,
    };
    if (details.length < RULES.minFitVideos) notes.push(`Your channel has only ${details.length} recent uploads, too few to judge whether this topic fits it.`);

    // "Your usual Short": each recent Short's retention on its own timeline, then the median per second.
    if (options.maxBaselineShorts > 0) {
      const picks = shorts.filter((v) => v.durationSec && ageDays(v.publishedAt, now) >= MIN_AGE_DAYS).slice(0, options.maxBaselineShorts);
      const curves = await mapLimit(picks, 4, (v) => settle(curveFor(accessToken, v, v.durationSec as number, now), 'retention'));
      const usable = curves.flatMap((c) => (c.ok && c.data.length > 0 ? [c.data] : []));
      baselineCount = usable.length;
      usual = usualCurve(usable);
      if (!usual && picks.length > 0) notes.push(`Only ${baselineCount} of your recent Shorts have retention data; at least ${RULES.minBaselineShorts} are needed for a “your usual Short” comparison.`);
    }
  }

  // The linked Short's own retention.
  let retention: RetentionPoint[] | null = null;
  if (linked) {
    const age = ageDays(linked.publishedAt, now);
    if (linked.durationSec !== null && Math.abs(linked.durationSec - durationSec) > DURATION_TOLERANCE_SEC) {
      notes.push(`The linked Short is ${linked.durationSec}s long but your file is ${Math.round(durationSec)}s, so they may not be the same video. Its retention is not shown.`);
    } else if (age < MIN_AGE_DAYS) {
      notes.push(`The Short was published ${Math.max(0, Math.floor(age))} day(s) ago. YouTube needs about ${MIN_AGE_DAYS} days to report retention; run it again after that.`);
    } else {
      const result = await settle(curveFor(accessToken, linked, durationSec, now), 'audience retention');
      if (result.ok && result.data.length > 1) retention = result.data;
      else notes.push(result.ok ? 'YouTube has no retention data for this Short yet (it may need more views).' : result.reason);
    }
  } else {
    notes.push('This is a check before publishing, so there is no retention for this Short yet. After it has been up for 3 days, run it again with its link to see where viewers actually left.');
  }

  return {
    context: {
      videoId,
      title: linked?.title ?? null,
      publishedAt: linked?.publishedAt ?? null,
      retention,
      usual,
      baselineCount,
      profile,
      notes,
    },
    uploads,
  };
}
