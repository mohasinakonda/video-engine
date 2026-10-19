import { embed } from '@/lib/llm-providers';
import { DISCOVER_RULES } from '../analysis/rules-config';
import type { PublicConnection } from '../connection-service';
import { fetchChannelsById, fetchMyChannels, fetchUploadIds, fetchVideoDetails, type ChannelIdentity } from '../data-client';
import { ChannelMismatchError, mapLimit, settle } from '../fetcher';
import { GoogleApiError } from '../google-fetch';
import { searchVideos, type SearchHit } from '../public-client';
import type { DiscoverSettings } from '../settings';
import { UserFacingError } from '../errors';
import type { StageDetail } from '../stream-analysis';
import type { Confidence, VideoMeta } from '../types';
import { bestMatches, normalizeTitle } from './similarity';
import type {
  CandidateSignals,
  CompetitorCandidate,
  CompetitorGroup,
  DiscoveryResult,
  DiscoveryStage,
  PublicChannel,
  Relevance,
} from './types';

const R = DISCOVER_RULES.discovery;
const DAY_MS = 86_400_000;

// ─── Pure helpers (tested directly) ──────────────────────────────────────────

export interface RankedChannel {
  channelId: string;
  queriesMatched: number;
  hits: number;
}

/**
 * Channels from several searches, deduplicated, without excluded ids (your channel, your
 * watchlist), ranked by how many phrases found them and then by how many videos they had.
 */
export function rankSearchChannels(resultsPerQuery: SearchHit[][], exclude: Set<string>, max: number): RankedChannel[] {
  const byChannel = new Map<string, RankedChannel>();
  resultsPerQuery.forEach((hits) => {
    const seenInQuery = new Set<string>();
    for (const { channelId } of hits) {
      if (exclude.has(channelId)) continue;
      const entry = byChannel.get(channelId) ?? { channelId, queriesMatched: 0, hits: 0 };
      entry.hits += 1;
      if (!seenInQuery.has(channelId)) {
        entry.queriesMatched += 1;
        seenInQuery.add(channelId);
      }
      byChannel.set(channelId, entry);
    }
  });
  return Array.from(byChannel.values())
    .sort((a, b) => b.queriesMatched - a.queriesMatched || b.hits - a.hits || a.channelId.localeCompare(b.channelId))
    .slice(0, max);
}

/** Share of videos that are likely Shorts (by duration). Null when no duration is known. */
export function shortsShare(videos: Pick<VideoMeta, 'durationSec'>[]): number | null {
  const known = videos.filter((v) => v.durationSec !== null);
  if (known.length === 0) return null;
  return known.filter((v) => (v.durationSec as number) <= R.shortsMaxSec).length / known.length;
}

export interface Assessment {
  relevance: Relevance;
  relevanceScore: number;
  suggestedGroup: CompetitorGroup;
  confidence: Confidence;
  reasons: string[];
}

/** Relevance, suggested group, confidence and plain reasons from measured signals only. */
export function assessCandidate(signals: CandidateSignals, strongModel: boolean): Assessment {
  const overlap = signals.titlesChecked > 0 ? signals.matchingTitles / signals.titlesChecked : 0;
  const queryShare = signals.queriesRun > 0 ? signals.queriesMatched / signals.queriesRun : 0;
  const relevanceScore = Math.round((0.7 * Math.min(1, overlap / 0.6) + 0.3 * queryShare) * 100) / 100;
  const relevance: Relevance = relevanceScore >= R.relevanceHigh ? 'high' : relevanceScore >= R.relevanceMedium ? 'medium' : 'low';

  const similarMix = Math.abs(signals.shortsShare - signals.yourShortsShare) <= R.formatMixTolerance;
  // "Format" only when the format mix really is similar; low topic overlap alone says nothing about format.
  const suggestedGroup: CompetitorGroup =
    overlap >= R.directOverlap && similarMix ? 'direct' : overlap < R.adjacentOverlap && similarMix ? 'format' : 'adjacent';

  let confidence: Confidence = signals.titlesChecked >= 10 ? 'high' : signals.titlesChecked >= 5 ? 'medium' : 'low';
  if (!strongModel && confidence === 'high') confidence = 'medium';

  const reasons = [
    `${signals.matchingTitles} of their ${signals.titlesChecked} recent titles are close to topics on your channel`,
    `Found by ${signals.queriesMatched} of ${signals.queriesRun} search phrase${signals.queriesRun === 1 ? '' : 's'}`,
    formatReason(signals.shortsShare, signals.yourShortsShare, similarMix),
    `${signals.uploadsLast90Days} upload${signals.uploadsLast90Days === 1 ? '' : 's'} in the last 90 days`,
  ];
  return { relevance, relevanceScore, suggestedGroup, confidence, reasons };
}

function formatReason(theirs: number, yours: number, similar: boolean): string {
  const describe = (share: number) => (share >= 0.7 ? 'mostly Shorts' : share <= 0.3 ? 'mostly long videos' : 'a mix of Shorts and long videos');
  return similar
    ? `Posts ${describe(theirs)}, like your channel`
    : `Posts ${describe(theirs)}; your channel posts ${describe(yours)}`;
}

export function toPublicChannel(c: ChannelIdentity): PublicChannel {
  return {
    id: c.id,
    title: c.title,
    thumbnail: c.thumbnail,
    url: c.url,
    subscriberCount: c.subscriberCount,
    videoCount: c.videoCount,
  };
}

// ─── The discovery run ───────────────────────────────────────────────────────

interface DiscoveryOptions {
  accessToken: string;
  connection: PublicConnection;
  settings: DiscoverSettings;
  queries: string[];
  /** Channels already on the user's watchlist (not suggested again). */
  watchlistIds: string[];
  onStage: (stage: DiscoveryStage, detail?: StageDetail) => void;
  now?: Date;
}

/**
 * Finds channels making similar videos now: search (budget already reserved by the route),
 * then each candidate's recent uploads compared with yours by meaning (embeddings).
 * Everything stays in memory; nothing is stored.
 */
export async function runDiscovery(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const { accessToken, connection, settings, queries, onStage } = options;
  const now = options.now ?? new Date();
  const limitations: string[] = [];

  // 1. Your channel: identity (for region/language) and recent titles.
  onStage('your_channel');
  const me = (await fetchMyChannels(accessToken)).find((c) => c.id === connection.channelId);
  if (!me) throw new ChannelMismatchError();
  const yourVideos = me.uploadsPlaylistId
    ? await fetchVideoDetails(accessToken, await fetchUploadIds(accessToken, me.uploadsPlaylistId, R.yourTitles))
    : [];
  const yourTitles = yourVideos.map((v) => normalizeTitle(v.title)).filter(Boolean);
  if (yourTitles.length < R.minYourTitles) {
    throw new UserFacingError(
      `Your channel needs at least ${R.minYourTitles} public videos before we can find similar channels. You can still add competitors by pasting their links.`
    );
  }

  // 2. Search (one call per phrase, already paid for from the shared budget).
  onStage('search', { count: queries.length });
  const publishedAfter = new Date(now.getTime() - R.searchWindowDays * DAY_MS).toISOString();
  const results: SearchHit[][] = [];
  for (const query of queries) {
    try {
      results.push(
        await searchVideos(accessToken, {
          query,
          publishedAfter,
          regionCode: me.country,
          relevanceLanguage: me.defaultLanguage,
          dailyLimit: settings.searchDailyGlobalLimit,
          prepaid: true,
        })
      );
    } catch (err) {
      // Keep what earlier phrases found; a quota error means later phrases would fail too.
      if (err instanceof GoogleApiError && err.kind === 'quota' && results.length > 0) {
        limitations.push('YouTube’s search limit was reached part-way, so some phrases were not searched.');
        break;
      }
      throw err;
    }
  }
  const queriesRun = results.length;

  const exclude = new Set([me.id, ...options.watchlistIds]);
  const ranked = rankSearchChannels(results, exclude, R.maxCandidates);
  const channelsFound = new Set(results.flat().map((h) => h.channelId)).size;
  if (ranked.length === 0) {
    return { queries: queries.slice(0, queriesRun), candidates: [], channelsFound, limitations, embeddingModel: null };
  }

  // 3. Candidates: public channel info and their recent uploads.
  onStage('candidates', { count: ranked.length });
  const channels = await fetchChannelsById(accessToken, ranked.map((r) => r.channelId));
  const uploads = await mapLimit(channels, 4, (c) =>
    settle(
      c.uploadsPlaylistId
        ? fetchUploadIds(accessToken, c.uploadsPlaylistId, R.titlesPerCandidate).then((ids) => fetchVideoDetails(accessToken, ids))
        : Promise.resolve([] as VideoMeta[]),
      'candidate uploads'
    )
  );
  const unreadable = uploads.filter((u) => !u.ok).length;
  if (unreadable > 0) limitations.push(`${unreadable} channel${unreadable === 1 ? '' : 's'} could not be read and were skipped.`);

  const active = channels
    .map((channel, i) => ({ channel, videos: uploads[i].ok ? uploads[i].data : [] }))
    .filter(({ videos }) => videos.some((v) => now.getTime() - Date.parse(v.publishedAt) <= R.searchWindowDays * DAY_MS));
  const inactive = channels.length - unreadable - active.length;
  if (inactive > 0) limitations.push(`${inactive} channel${inactive === 1 ? '' : 's'} with no upload in the last 90 days were left out.`);

  // 4. Classify: compare titles by meaning.
  onStage('classify', { count: active.length });
  const theirTitles = active.map(({ videos }) => videos.map((v) => normalizeTitle(v.title)));
  const embedded = await embed({
    texts: [...yourTitles, ...theirTitles.flat()],
    models: settings.embeddingModels,
    tag: 'discover:discovery',
  });
  if (!embedded) throw new UserFacingError('Topic matching is unavailable right now. Please try again in a few minutes.');

  const yourVectors = embedded.vectors.slice(0, yourTitles.length);
  const threshold = DISCOVER_RULES.titleMatch[embedded.model] ?? DISCOVER_RULES.titleMatch.default;
  const strongModel = (DISCOVER_RULES.strongEmbeddingModels as readonly string[]).includes(embedded.model);
  if (!strongModel) limitations.push('A backup topic model was used, so matches between languages are less reliable.');
  const yourShorts = shortsShare(yourVideos) ?? 0;

  let offset = yourTitles.length;
  const candidates: CompetitorCandidate[] = active.map(({ channel, videos }, i) => {
    const vectors = embedded.vectors.slice(offset, offset + theirTitles[i].length);
    offset += theirTitles[i].length;
    const scores = bestMatches(vectors, yourVectors);
    const rank = ranked.find((r) => r.channelId === channel.id);

    const signals: CandidateSignals = {
      matchingTitles: scores.filter((s) => s >= threshold).length,
      titlesChecked: videos.length,
      queriesMatched: rank?.queriesMatched ?? 0,
      queriesRun,
      uploadsLast90Days: videos.filter((v) => now.getTime() - Date.parse(v.publishedAt) <= R.searchWindowDays * DAY_MS).length,
      shortsShare: shortsShare(videos) ?? 0,
      yourShortsShare: yourShorts,
    };
    const exampleTitles = Array.from(
      new Set(
        videos
          .map((v, j) => ({ title: v.title.trim(), score: scores[j] }))
          .filter((t) => t.score >= threshold)
          .sort((a, b) => b.score - a.score)
          .map((t) => t.title)
      )
    ).slice(0, 3);

    return { channel: toPublicChannel(channel), ...assessCandidate(signals, strongModel), exampleTitles, signals };
  });

  // A channel with no title close to yours isn't a competitor, whatever search returned.
  const matching = candidates.filter((c) => c.signals.matchingTitles > 0);
  const unrelated = candidates.length - matching.length;
  if (unrelated > 0) limitations.push(`${unrelated} channel${unrelated === 1 ? '' : 's'} from the search had no videos close to your topics and were left out.`);

  matching.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return {
    queries: queries.slice(0, queriesRun),
    candidates: matching.slice(0, R.maxSuggestions),
    channelsFound,
    limitations,
    embeddingModel: embedded.model,
  };
}
