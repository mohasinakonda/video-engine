/**
 * Who made videos on this topic, and how they perform (pure; nothing stored). Raw views mislead
 * (old videos and big channels win by default), so each video is also read as views per day,
 * views per subscriber, and, for the top channels, × that channel's usual.
 */
import { median } from '../analysis/stats';
import { judgeVideo, publicBaselines, publicFormat } from '../discover/outliers';
import type { MarketVideo } from '../discover/types';
import { titleSimilarity } from './publish';
import type { FoundChannel, FoundVideo } from './topic-fetch';

const DAY = 86_400_000;
/** A video's first days are a spike; views per day count at least this many days. */
export const MIN_DAYS_FOR_RATE = 7;
const BANGLA = /[ঀ-৿]/;

export type ChannelSize = 'tiny' | 'small' | 'mid' | 'big' | 'unknown';
export const sizeOf = (subs: number | null): ChannelSize => (subs === null ? 'unknown' : subs < 10_000 ? 'tiny' : subs < 100_000 ? 'small' : subs < 1_000_000 ? 'mid' : 'big');

export interface TopicVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  subscribers: number | null;
  size: ChannelSize;
  publishedAt: string;
  ageDays: number;
  format: 'short' | 'video' | null;
  views: number | null;
  /** Views ÷ max(age, 7 days), so a two-day-old spike doesn't top the list. */
  viewsPerDay: number | null;
  /** Younger than a week: still collecting its first views. */
  isNew: boolean;
  /** Views ÷ the channel's subscribers: above 1 means it reached beyond its own audience. */
  perSubscriber: number | null;
  /** Views ÷ the channel's usual for that format (top channels only). */
  usualRatio: number | null;
  thumbnailUrl: string | null;
  bangla: boolean;
}

export interface TopicLandscape {
  topic: string;
  videos: TopicVideo[];
  summary: {
    found: number;
    last30: number;
    last90: number;
    channels: number;
    medianViews: number | null;
    medianViewsPerDay: number | null;
    sizes: Record<ChannelSize, number>;
    bangla: number;
    shorts: number;
    /** Small channels (under 100K) whose video reached far beyond them, long-form and Shorts. */
    smallWins: number;
    smallWinsLong: number;
    crowd: 'quiet' | 'active' | 'crowded';
  };
  signals: string[];
  /** Results whose title is very close to the planned angle or title directions. */
  similar: { id: string; title: string; to: string }[];
  limitations: string[];
}

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** How each top channel usually does, from its own uploads: the ratio for the found video. */
export function usualRatio(video: FoundVideo, uploads: FoundVideo[], now: Date): number | null {
  const asMarket = (v: FoundVideo): MarketVideo => ({ id: v.id, channelId: v.channelId, title: v.title, publishedAt: v.publishedAt, durationSec: v.durationSec, views: v.views, likes: null, comments: null, thumbnailUrl: v.thumbnailUrl });
  const baselines = publicBaselines(uploads.filter((u) => u.id !== video.id).map(asMarket), now);
  const j = judgeVideo(asMarket(video), baselines, now);
  return j.ratio === null ? null : round(j.ratio);
}

export function buildLandscape(input: {
  topic: string;
  /** What the creator plans to say, to flag results that are too close. */
  plannedLines: string[];
  videos: FoundVideo[];
  channels: FoundChannel[];
  usual: Map<string, number | null>;
  now: Date;
}): TopicLandscape {
  const { now } = input;
  const channelOf = new Map(input.channels.map((c) => [c.id, c]));
  const videos: TopicVideo[] = input.videos
    .filter((v) => !v.liveOrUpcoming)
    .map((v) => {
      const ch = channelOf.get(v.channelId);
      const subscribers = ch?.subscribers ?? null;
      const ageDays = Math.max(1, Math.floor((now.getTime() - Date.parse(v.publishedAt)) / DAY));
      return {
        id: v.id,
        title: v.title,
        channelId: v.channelId,
        channelTitle: ch?.title ?? '',
        subscribers,
        size: sizeOf(subscribers),
        publishedAt: v.publishedAt,
        ageDays,
        format: publicFormat(v.durationSec),
        views: v.views,
        viewsPerDay: v.views === null ? null : round(v.views / Math.max(ageDays, MIN_DAYS_FOR_RATE)),
        isNew: ageDays < MIN_DAYS_FOR_RATE,
        perSubscriber: v.views !== null && subscribers ? round(v.views / subscribers) : null,
        usualRatio: input.usual.get(v.id) ?? null,
        thumbnailUrl: v.thumbnailUrl,
        bangla: BANGLA.test(v.title),
      };
    });

  const views = videos.map((v) => v.views).filter((x): x is number => x !== null);
  const perDay = videos.map((v) => v.viewsPerDay).filter((x): x is number => x !== null);
  const sizes: Record<ChannelSize, number> = { tiny: 0, small: 0, mid: 0, big: 0, unknown: 0 };
  videos.forEach((v) => sizes[v.size]++);
  const smallWinners = videos.filter((v) => (v.size === 'tiny' || v.size === 'small') && ((v.perSubscriber ?? 0) >= 2 || (v.usualRatio ?? 0) >= 2));
  const last30 = videos.filter((v) => v.ageDays <= 30).length;
  const last90 = videos.filter((v) => v.ageDays <= 90).length;
  const crowd: TopicLandscape['summary']['crowd'] = last90 >= 10 ? 'crowded' : last90 >= 3 ? 'active' : 'quiet';
  const bangla = videos.filter((v) => v.bangla).length;
  const shorts = videos.filter((v) => v.format === 'short').length;

  // Plain statements from the numbers above; nothing is guessed.
  const signals: string[] = [];
  if (videos.length === 0) signals.push('YouTube returned no videos for this topic. Try fewer or simpler words.');
  else {
    signals.push(
      crowd === 'crowded'
        ? `Crowded: ${last90} of these videos came out in the last 90 days.`
        : crowd === 'active'
          ? `Active: ${plural(last90, 'video')} in the last 90 days.`
          : `Quiet: ${last90 === 0 ? 'none' : `only ${last90}`} of these came out in the last 90 days.`
    );
    const longWins = smallWinners.filter((v) => v.format === 'video').length;
    const shortWins = smallWinners.length - longWins;
    if (longWins) {
      signals.push(`${plural(longWins, 'long video')} from channels under 100K subscribers reached far beyond their audience: new channels can win here${shortWins ? ` (plus ${plural(shortWins, 'Short')})` : ''}.`);
    } else if (shortWins) {
      signals.push(`Small channels broke out only with Shorts here (${shortWins}); long videos from small channels didn’t.`);
    }
    else if (sizes.big + sizes.mid > videos.length / 2) signals.push('Mostly channels with 100K+ subscribers rank here, and no small channel broke out.');
    if (bangla === 0) signals.push('None of these videos are in Bangla.');
    else if (bangla < videos.length / 4) signals.push(`Only ${bangla} are in Bangla.`);
    if (shorts > videos.length / 2) signals.push('Most results are Shorts.');
  }

  // Too close to what the creator plans? Word overlap with each planned line.
  const similar: TopicLandscape['similar'] = [];
  for (const v of videos) {
    const to = input.plannedLines.find((line) => line.split(/\s+/).length >= 3 && titleSimilarity(line, v.title) >= 0.75);
    if (to) similar.push({ id: v.id, title: v.title, to });
  }

  return {
    topic: input.topic,
    videos,
    summary: {
      found: videos.length,
      last30,
      last90,
      channels: new Set(videos.map((v) => v.channelId)).size,
      medianViews: median(views),
      medianViewsPerDay: perDay.length ? round(median(perDay) as number) : null,
      sizes,
      bangla,
      shorts,
      smallWins: smallWinners.length,
      smallWinsLong: smallWinners.filter((v) => v.format === 'video').length,
      crowd,
    },
    signals,
    similar: similar.slice(0, 5),
    limitations: [
      'These are the videos YouTube ranks as most relevant to the topic, not every video on it.',
      '“× its usual” is shown only for the top channels; views per day and per subscriber are shown for all.',
    ],
  };
}
