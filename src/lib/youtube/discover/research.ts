import { DISCOVER_RULES } from '../analysis/rules-config';
import type { PublicConnection } from '../connection-service';
import { fetchChannelsById, fetchMyChannels, fetchUploadIds, fetchVideoDetails, type ChannelIdentity } from '../data-client';
import { UserFacingError } from '../errors';
import { ChannelMismatchError, mapLimit } from '../fetcher';
import { GoogleApiError } from '../google-fetch';
import type { DiscoverSettings } from '../settings';
import type { StageDetail } from '../stream-analysis';
import { profileChannel } from './competitor-analysis';
import { toPublicChannel } from './discovery';
import type { ChannelProfile, CompetitorStatus, MarketVideo, Outlier, ResearchResult, ResearchStage, ResearchWindow } from './types';

export const WINDOW_DAYS: Record<ResearchWindow, number> = { '30d': 30, '90d': 90 };

/** Fewer readable competitors than this and the research can't say anything about a market. */
export const MIN_COMPETITORS = 2;

interface ResearchOptions {
  accessToken: string;
  connection: PublicConnection;
  settings: DiscoverSettings;
  window: ResearchWindow;
  /** Active watchlist channel ids, read from the database by the route. */
  competitorIds: string[];
  onStage: (stage: ResearchStage, detail?: StageDetail) => void;
  now?: Date;
}

/** A channel's recent public uploads as MarketVideos (2 units per 50 videos). */
async function fetchRecentVideos(accessToken: string, channel: ChannelIdentity, max: number): Promise<MarketVideo[]> {
  if (!channel.uploadsPlaylistId) return [];
  const ids = await fetchUploadIds(accessToken, channel.uploadsPlaylistId, max);
  const videos = await fetchVideoDetails(accessToken, ids, { public: true });
  // Live streams in progress report a length of 0 and still-growing views; premieres have neither.
  return videos.filter((v) => !v.liveOrUpcoming && v.durationSec !== 0).map((v) => ({
    id: v.id,
    channelId: v.channelId || channel.id,
    title: v.title,
    publishedAt: v.publishedAt,
    durationSec: v.durationSec,
    views: v.lifetimeViews,
    likes: v.likes,
    comments: v.comments,
    thumbnailUrl: v.thumbnailUrl,
  }));
}

function unavailableReason(err: unknown): string {
  if (err instanceof GoogleApiError && err.reason === 'playlistNotFound') return 'Its uploads are not public.';
  return 'YouTube did not return its videos.';
}

/**
 * Market research (D3 scope: collect, baselines, outliers, profiles). Everything stays in
 * this request's memory; only the compact result goes back to the browser.
 */
export async function runResearch(options: ResearchOptions): Promise<ResearchResult> {
  const { accessToken, connection, settings, onStage } = options;
  const now = options.now ?? new Date();
  const windowDays = WINDOW_DAYS[options.window];
  const limitations: string[] = [];

  onStage('your_channel');
  const me = (await fetchMyChannels(accessToken)).find((c) => c.id === connection.channelId);
  if (!me) throw new ChannelMismatchError();

  onStage('competitors', { count: options.competitorIds.length });
  const found = await fetchChannelsById(accessToken, options.competitorIds);
  const byId = new Map(found.map((c) => [c.id, c]));
  const statuses: CompetitorStatus[] = options.competitorIds.map((id) => {
    const c = byId.get(id);
    return c ? { channelId: id, title: c.title, status: 'ok' } : { channelId: id, title: null, status: 'unavailable', reason: 'YouTube no longer returns this channel. It may be private or deleted.' };
  });

  const channels = [me, ...found];
  onStage('videos', { count: channels.length * settings.videosPerCompetitor });
  const fetched = await mapLimit(channels, 4, async (c) => {
    try {
      return { ok: true as const, data: await fetchRecentVideos(accessToken, c, settings.videosPerCompetitor) };
    } catch (err) {
      // A quota error affects every channel: stop instead of reporting each one as unavailable.
      if (err instanceof GoogleApiError && (err.kind === 'quota' || err.kind === 'auth')) throw err;
      return { ok: false as const, reason: unavailableReason(err) };
    }
  });

  // Your own uploads are required; a failing competitor only drops out.
  const mine = fetched[0];
  if (!mine.ok) throw new UserFacingError('We couldn’t read your channel’s videos from YouTube. Please try again.');

  const competitorVideos = new Map<string, MarketVideo[]>();
  found.forEach((c, i) => {
    const result = fetched[i + 1];
    if (result.ok) {
      competitorVideos.set(c.id, result.data);
    } else {
      const status = statuses.find((s) => s.channelId === c.id);
      if (status) Object.assign(status, { status: 'unavailable', reason: result.reason });
    }
  });

  const readable = found.filter((c) => competitorVideos.has(c.id));
  if (readable.length < MIN_COMPETITORS) {
    throw new UserFacingError(
      `Research needs at least ${MIN_COMPETITORS} competitors whose videos we can read (we could read ${readable.length}). Add more competitors and try again.`
    );
  }

  onStage('outliers', { count: readable.length + 1 });
  const you = profileChannel(toPublicChannel(me), mine.data, windowDays, now).profile;
  const competitors: ChannelProfile[] = [];
  const outliers: Outlier[] = [];
  for (const c of readable) {
    const { profile, outliers: found } = profileChannel(toPublicChannel(c), competitorVideos.get(c.id) as MarketVideo[], windowDays, now);
    competitors.push(profile);
    outliers.push(...found);
  }
  outliers.sort((a, b) => b.ratio - a.ratio);

  const thin = competitors.filter((p) => p.baselines.short.strength === 'insufficient' && p.baselines.video.strength === 'insufficient');
  if (thin.length > 0) {
    limitations.push(
      `${thin.map((p) => p.channel.title).join(', ')} ${thin.length === 1 ? 'has' : 'have'} too few older videos for a reliable baseline, so no outliers are claimed for ${thin.length === 1 ? 'it' : 'them'}.`
    );
  }
  limitations.push(
    'Shorts are estimated from length (3 minutes or less). Views are public lifetime totals, so videos younger than 7 days are not judged yet.'
  );
  const unavailable = statuses.filter((s) => s.status === 'unavailable').length;
  if (unavailable > 0) limitations.push(`${unavailable} competitor${unavailable === 1 ? ' was' : 's were'} left out (see the list).`);

  return {
    window: options.window,
    generatedAt: now.toISOString(),
    you,
    competitors,
    statuses,
    outliers: outliers.slice(0, DISCOVER_RULES.outliers.maxReported),
    videosAnalyzed: [mine.data, ...Array.from(competitorVideos.values())].reduce((n, v) => n + v.length, 0),
    limitations,
  };
}
