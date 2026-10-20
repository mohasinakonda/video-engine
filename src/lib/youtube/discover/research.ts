import { DISCOVER_RULES } from '../analysis/rules-config';
import type { PublicConnection } from '../connection-service';
import { fetchChannelsById, fetchMyChannels, fetchUploadIds, fetchVideoDetails, type ChannelIdentity } from '../data-client';
import { UserFacingError } from '../errors';
import { ChannelMismatchError, mapLimit } from '../fetcher';
import { GoogleApiError } from '../google-fetch';
import type { ChannelDoctorSettings } from '../settings';
import type { StageDetail } from '../stream-analysis';
import { profileChannel } from './competitor-analysis';
import { toPublicChannel } from './discovery';
import { ruleFormats } from './formats';
import { classifyWithAI } from './formats-ai';
import { summarizePatterns, summarizeTopics, tagOutliers, type TaggedVideo } from './market-patterns';
import { ageInDays } from './outliers';
import { mainLanguage } from './queries';
import { interpretOpportunities } from './ai/interpret';
import { buildOpportunities, type EngineContext, type TopicDetail } from './opportunities';
import { loadPhase1 } from './phase1';
import { buildTrackRecordInput } from '../create/track-record-input';
import type { LearningRow } from '../create/track-record';
import { meanVector } from './clustering';
import { buildTopics, type TopicInput } from './topics';
import type { ContentFormat } from './formats';
import { median } from '../analysis/stats';
import type { ChannelProfile, CompetitorStatus, MarketVideo, OutputLanguage, Outlier, ResearchResult, ResearchStage, ResearchWindow } from './types';

export const WINDOW_DAYS: Record<ResearchWindow, number> = { '30d': 30, '90d': 90 };

/** Fewer readable competitors than this and the research can't say anything about a market. */
export const MIN_COMPETITORS = 2;

interface ResearchOptions {
  userId: string;
  accessToken: string;
  connection: PublicConnection;
  reportingJobId: string | null;
  /** All admin settings: Discover limits and weights, plus the text models and Channel Doctor limits. */
  settings: ChannelDoctorSettings;
  window: ResearchWindow;
  /** Language of angles and explanations; 'auto' follows your titles. */
  language?: OutputLanguage;
  /** Active watchlist channel ids, read from the database by the route. */
  competitorIds: string[];
  /** The creator's learning records (Create), read by the route. */
  learning?: LearningRow[];
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
  const { accessToken, connection, onStage } = options;
  const settings = options.settings.discover;
  const textModels = options.settings.textModels;
  const now = options.now ?? new Date();
  const windowDays = WINDOW_DAYS[options.window];
  const limitations: string[] = [];

  onStage('your_channel');
  // Channel Doctor's diagnosis (Analytics API) runs alongside the public research.
  const phase1Promise = loadPhase1({
    userId: options.userId,
    accessToken,
    connection,
    reportingJobId: options.reportingJobId,
    settings: options.settings,
  });
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
  const eligibleIds = new Set<string>();
  const ratios = new Map<string, number>();
  for (const c of readable) {
    const result = profileChannel(toPublicChannel(c), competitorVideos.get(c.id) as MarketVideo[], windowDays, now);
    competitors.push(result.profile);
    outliers.push(...result.outliers);
    result.eligibleIds.forEach((id) => eligibleIds.add(id));
    result.ratios.forEach((r, id) => ratios.set(id, r));
  }
  outliers.sort((a, b) => b.ratio - a.ratio);
  const outlierIds = new Set(outliers.map((o) => o.videoId));

  // Every video of the last year, tagged with its format by rule (the model fills gaps below).
  const tagged: TaggedVideo[] = [
    ...mine.data.map((v) => ({ ...v, channelTitle: me.title, isYours: true })),
    ...readable.flatMap((c) => (competitorVideos.get(c.id) as MarketVideo[]).map((v) => ({ ...v, channelTitle: c.title, isYours: false }))),
  ]
    .filter((v) => ageInDays(v.publishedAt, now) <= DISCOVER_RULES.topics.maxAgeDays)
    .map((v) => ({ ...v, format: ruleFormats(v.title) }));
  const videosById = new Map(tagged.map((v) => [v.id, v]));
  const titleLanguage = mainLanguage(mine.data.map((v) => v.title));
  const language = options.language === 'bn' ? 'Bangla' : options.language === 'en' ? 'English' : titleLanguage;

  onStage('topics', { count: tagged.length });
  const build = await buildTopics(
    tagged.map((v): TopicInput => ({ id: v.id, channelId: v.channelId, channelTitle: v.channelTitle, title: v.title, isYours: v.isYours })),
    // Topic names follow your titles' language; the user's choice applies to the advice text.
    { embeddingModels: settings.embeddingModels, textModels, language: titleLanguage }
  );
  if (!build.embeddingModel) limitations.push('Topic matching was unavailable for this run, so topics are not shown.');
  else if (!(DISCOVER_RULES.strongEmbeddingModels as readonly string[]).includes(build.embeddingModel)) {
    limitations.push('A backup topic model was used, so topic groups are less reliable.');
  }

  // Formats: titles the rules can't place go to the model — those that matter for the
  // comparisons (yours, and competitors' judged videos in the window), capped per run.
  onStage('formats', { count: tagged.length });
  const forAI = tagged
    .filter((v) => !v.format.primary && (v.isYours || eligibleIds.has(v.id)))
    .slice(0, DISCOVER_RULES.topics.maxAiFormatTitles);
  const batches: TaggedVideo[][] = [];
  for (let i = 0; i < forAI.length; i += 100) batches.push(forAI.slice(i, i + 100));
  const aiResults = await mapLimit(batches, 3, (batch) => classifyWithAI(batch.map((v) => v.title), textModels));
  batches.forEach((batch, b) => aiResults[b].forEach((tag, n) => (batch[n].format = tag)));

  const allTaggedOutliers = tagOutliers(outliers, build.assignment, videosById);
  const topicSummaries = build.embeddingModel
    ? summarizeTopics(
        build.topics,
        build.labels,
        tagged.map((v) => ({ id: v.id, channelId: v.channelId, channelTitle: v.channelTitle, title: v.title, isYours: v.isYours })),
        videosById,
        outlierIds,
        now
      ).sort((a, b) => b.outlierCount - a.outlierCount || b.competitorChannelCount - a.competitorChannelCount || b.videoCount - a.videoCount)
    : [];
  const topics = topicSummaries;

  // Opportunities: gaps, momentum, scores and confidence, steered by Channel Doctor.
  onStage('opportunities', { count: topics.length });
  const phase1 = await phase1Promise;
  if (!phase1) limitations.push('Channel Doctor data (YouTube Analytics) was unavailable, so recommendations are not adjusted to your diagnosis.');
  const yours = tagged.filter((v) => v.isYours);
  const best = phase1 ? yours.filter((v) => phase1.videos.get(v.id)?.label === 'outperformer') : [];
  const centreFrom = (best.length >= 3 ? best : yours).map((v) => build.vectors.get(v.id)).filter((x): x is number[] => Boolean(x));
  const yourFormats = new Map<ContentFormat, { videos: number; medianAvgViewPct: number | null }>();
  for (const v of yours) {
    if (!v.format.primary) continue;
    const entry = yourFormats.get(v.format.primary) ?? { videos: 0, medianAvgViewPct: null };
    entry.videos += 1;
    yourFormats.set(v.format.primary, entry);
  }
  yourFormats.forEach((entry, format) => {
    const avps = yours
      .filter((v) => v.format.primary === format)
      .map((v) => phase1?.videos.get(v.id)?.avgViewPct)
      .filter((x): x is number => typeof x === 'number');
    entry.medianAvgViewPct = median(avps);
  });

  const rawById = new Map(build.topics.map((t) => [t.id, t]));
  const details: TopicDetail[] = topics.map((summary) => {
    const members = tagged.filter((v) => build.assignment.get(v.id) === summary.id);
    return {
      summary,
      centroid: rawById.get(summary.id)?.centroid ?? [],
      yours: members.filter((v) => v.isYours),
      theirs: members.filter((v) => !v.isYours),
      outliers: allTaggedOutliers.filter((o) => o.topicId === summary.id),
    };
  });
  // Your measured Create videos (labels only, read by the route); a failure never blocks the research.
  const trackRecord = options.learning?.length
    ? await buildTrackRecordInput(options.learning, options.settings.create.learningMinVideos, build.embeddingModel).catch(() => null)
    : null;
  const ctx: EngineContext = {
    window: options.window,
    now,
    weights: settings.weights,
    phase1,
    yourCentre: centreFrom.length ? meanVector(centreFrom) : null,
    ratios,
    competitorsTotal: readable.length,
    unavailableShare: statuses.length ? statuses.filter((st) => st.status === 'unavailable').length / statuses.length : 0,
    strongEmbedding: build.embeddingModel !== null && (DISCOVER_RULES.strongEmbeddingModels as readonly string[]).includes(build.embeddingModel),
    yourFormats,
    trackRecord,
  };
  const scored = build.embeddingModel ? buildOpportunities(details, ctx) : [];

  // Angles: the model writes text only; the originality guard and number checks decide what stays.
  onStage('angles', { count: scored.length });
  const competitorTitles = new Map(details.map((d) => [d.summary.id, d.theirs.map((v) => v.title)]));
  const competitorVectors = new Map(details.map((d) => [d.summary.id, d.theirs.map((v) => build.vectors.get(v.id))]));
  const { opportunities, aiUsed } = await interpretOpportunities({
    channelTitle: me.title,
    language,
    yourTopics: topics.filter((t) => t.yourVideoCount > 0).map((t) => t.label),
    diagnosis: phase1?.primary ? `Main problem found by Channel Doctor: ${phase1.primary}` : null,
    opportunities: scored,
    competitorTitles,
    competitorVectors,
    textModels,
    embeddingModels: settings.embeddingModels,
  });
  if (scored.length > 0 && !aiUsed) limitations.push('The AI writer was unavailable, so ideas use plain topic names instead of written angles.');

  const patterns = summarizePatterns(
    tagged.filter((v) => !v.isYours && eligibleIds.has(v.id)),
    outlierIds,
    tagged.filter((v) => v.isYours)
  );

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
    outliers: allTaggedOutliers.slice(0, DISCOVER_RULES.outliers.maxReported),
    topics,
    patterns,
    opportunities,
    phase1: { primary: phase1?.primary ?? null, available: phase1 !== null },
    language,
    aiUsed,
    embeddingModel: build.embeddingModel,
    videosAnalyzed: [mine.data, ...Array.from(competitorVideos.values())].reduce((n, v) => n + v.length, 0),
    limitations,
  };
}
