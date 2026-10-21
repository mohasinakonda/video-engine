/**
 * Channel overview for the channel audit: the public profile, its whole upload history and
 * what its recent videos show (niche, views by publish date, length mix, engagement, tags).
 * Public data only: viewer ages, countries, traffic sources and view or subscriber history
 * belong to the channel's owner and are never estimated here.
 */
import { YOUTUBE_DATA_API } from '../config';
import { googleJson } from '../google-fetch';
import { median } from '../analysis/stats';
import { publicFormat } from '../discover/outliers';
import type { PublicFormat } from '../discover/types';
import type { AuditChannelVideo } from './fetch';

export interface ChannelProfile {
  createdAt: string | null;
  handle: string | null;
  country: string | null;
  language: string | null;
  description: string;
  keywords: string[];
  /** YouTube's own topic labels for the channel, e.g. "Animals". */
  topics: string[];
  totalViews: number | null;
  subscribers: number | null;
  videoCount: number | null;
}

export interface UploadHistory {
  /** Publish dates of the uploads read, newest first. */
  dates: string[];
  /** False when the channel has more uploads than were read. */
  complete: boolean;
}

export interface OverviewVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  views: number;
  likes: number | null;
  comments: number | null;
  format: PublicFormat;
}

export interface ChannelOverview {
  profile: ChannelProfile;
  /** Category of its recent videos, most used first. */
  categories: { name: string; share: number }[];
  firstUploadAt: string | null;
  /** The oldest upload read when the history is incomplete. */
  oldestReadAt: string | null;
  uploadsRead: number;
  uploadsByMonth: { month: string; count: number }[];
  /** Recent videos with a public view count, for views by publish date. */
  videos: OverviewVideo[];
  lengthMix: { label: string; count: number; medianViews: number | null }[];
  engagement: {
    medianViews: number | null;
    averageViews: number | null;
    /** Median views ÷ subscribers. */
    viewsPerSubscriber: number | null;
    likesPer1kViews: number | null;
    commentsPer1kViews: number | null;
  };
  mostLiked: OverviewVideo[];
  mostCommented: OverviewVideo[];
  topTags: { tag: string; count: number }[];
}

/** YouTube's video categories (videoCategories.list); ids are stable. */
const CATEGORIES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
};

/** Upload dates read for the history: 1 quota unit per 50. */
export const HISTORY_MAX_UPLOADS = 1000;
/** Engagement rates are noise below this many views. */
const MIN_VIEWS_FOR_RATES = 100;

const num = (v: string | undefined) => (v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

/** "https://en.wikipedia.org/wiki/Lifestyle_(sociology)" → "Lifestyle". */
export function topicLabel(url: string): string {
  const last = decodeURIComponent(url.split('/').pop() ?? '');
  return last.replace(/_/g, ' ').replace(/\s*\(.*\)$/, '').trim();
}

/** The channel's public profile. 1 unit. */
export async function fetchChannelProfile(accessToken: string, channelId: string): Promise<ChannelProfile | null> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,brandingSettings,topicDetails',
    id: channelId,
    fields:
      'items(snippet(customUrl,description,publishedAt,country,defaultLanguage),statistics(viewCount,subscriberCount,hiddenSubscriberCount,videoCount),brandingSettings/channel/keywords,topicDetails/topicCategories)',
  });
  const data = await googleJson<{
    items?: {
      snippet?: { customUrl?: string; description?: string; publishedAt?: string; country?: string; defaultLanguage?: string };
      statistics?: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
      brandingSettings?: { channel?: { keywords?: string } };
      topicDetails?: { topicCategories?: string[] };
    }[];
  }>(`${YOUTUBE_DATA_API}/channels?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const item = data.items?.[0];
  if (!item) return null;
  const s = item.snippet ?? {};
  return {
    createdAt: s.publishedAt ?? null,
    handle: s.customUrl ?? null,
    country: s.country ?? null,
    language: s.defaultLanguage ?? null,
    description: (s.description ?? '').slice(0, 1000),
    keywords: parseKeywords(item.brandingSettings?.channel?.keywords ?? ''),
    topics: Array.from(new Set((item.topicDetails?.topicCategories ?? []).map(topicLabel).filter(Boolean))),
    totalViews: num(item.statistics?.viewCount),
    subscribers: item.statistics?.hiddenSubscriberCount ? null : num(item.statistics?.subscriberCount),
    videoCount: num(item.statistics?.videoCount),
  };
}

/** Channel keywords are space-separated, with multi-word keywords in double quotes. */
export function parseKeywords(raw: string): string[] {
  const out = Array.from(raw.matchAll(/"([^"]+)"|(\S+)/g), (m) => (m[1] ?? m[2]).trim()).filter(Boolean);
  return Array.from(new Set(out)).slice(0, 30);
}

/** Publish dates from the uploads playlist, newest first, up to `max`. 1 unit per 50. */
export async function fetchUploadHistory(accessToken: string, channelId: string, max = HISTORY_MAX_UPLOADS): Promise<UploadHistory> {
  const dates: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId: `UU${channelId.slice(2)}`,
      maxResults: '50',
      fields: 'items/contentDetails/videoPublishedAt,nextPageToken',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await googleJson<{ items?: { contentDetails?: { videoPublishedAt?: string } }[]; nextPageToken?: string }>(
      `${YOUTUBE_DATA_API}/playlistItems?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    for (const item of page.items ?? []) {
      if (item.contentDetails?.videoPublishedAt) dates.push(item.contentDetails.videoPublishedAt);
    }
    pageToken = page.nextPageToken;
  } while (pageToken && dates.length < max);
  return { dates: dates.slice(0, max), complete: !pageToken };
}

/** Every month from the oldest upload read to `now`, empty months included. */
export function uploadsByMonth(dates: string[], now: Date): { month: string; count: number }[] {
  if (!dates.length) return [];
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d.slice(0, 7), (counts.get(d.slice(0, 7)) ?? 0) + 1);
  const oldest = dates.reduce((a, b) => (a < b ? a : b));
  const out: { month: string; count: number }[] = [];
  let y = Number(oldest.slice(0, 4));
  let m = Number(oldest.slice(5, 7));
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ month: key, count: counts.get(key) ?? 0 });
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const LENGTHS: { label: string; test: (sec: number, format: PublicFormat) => boolean }[] = [
  { label: 'Shorts', test: (_s, f) => f === 'short' },
  { label: 'Under 8 min', test: (s, f) => f === 'video' && s < 480 },
  { label: '8–15 min', test: (s, f) => f === 'video' && s >= 480 && s < 900 },
  { label: '15–30 min', test: (s, f) => f === 'video' && s >= 900 && s < 1800 },
  { label: '30 min+', test: (s, f) => f === 'video' && s >= 1800 },
];

const perThousand = (videos: OverviewVideo[], pick: (v: OverviewVideo) => number | null) => {
  const rates = videos.filter((v) => v.views >= MIN_VIEWS_FOR_RATES && pick(v) !== null).map((v) => ((pick(v) as number) / v.views) * 1000);
  const m = median(rates);
  return m === null ? null : Math.round(m * 10) / 10;
};

/** Pure: the overview from the profile, the upload history and the recent videos already read. */
export function buildChannelOverview(
  profile: ChannelProfile,
  history: UploadHistory,
  recent: (AuditChannelVideo & { categoryId?: string | null })[],
  now: Date
): ChannelOverview {
  const videos: OverviewVideo[] = recent.flatMap((v) => {
    const format = publicFormat(v.durationSec);
    return format && v.views !== null && v.publishedAt
      ? [{ id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, publishedAt: v.publishedAt, views: v.views, likes: v.likes, comments: v.comments, format }]
      : [];
  });

  const categoryCounts = new Map<string, number>();
  for (const v of recent) {
    const name = v.categoryId ? CATEGORIES[v.categoryId] : undefined;
    if (name) categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }
  const categorized = Array.from(categoryCounts.values()).reduce((a, b) => a + b, 0);
  const categories = Array.from(categoryCounts, ([name, count]) => ({ name, share: count / categorized })).sort((a, b) => b.share - a.share);

  const lengthMix = LENGTHS.map(({ label, test }) => {
    const group = videos.filter((v) => {
      const sec = recent.find((r) => r.id === v.id)?.durationSec ?? 0;
      return test(sec, v.format);
    });
    return { label, count: group.length, medianViews: median(group.map((v) => v.views)) };
  }).filter((g) => g.count > 0);

  const views = videos.map((v) => v.views);
  const medianViews = median(views);
  const oldest = history.dates.length ? history.dates.reduce((a, b) => (a < b ? a : b)) : null;

  const tagCounts = new Map<string, { tag: string; count: number }>();
  for (const v of recent) {
    for (const tag of Array.from(new Set(v.tags.map((t) => t.trim()).filter(Boolean)))) {
      const key = tag.toLowerCase();
      const entry = tagCounts.get(key) ?? { tag, count: 0 };
      entry.count++;
      tagCounts.set(key, entry);
    }
  }

  const top = (pick: (v: OverviewVideo) => number | null) =>
    videos.filter((v) => (pick(v) ?? 0) > 0).sort((a, b) => (pick(b) as number) - (pick(a) as number)).slice(0, 3);

  return {
    profile,
    categories,
    firstUploadAt: history.complete ? oldest : null,
    oldestReadAt: history.complete ? null : oldest,
    uploadsRead: history.dates.length,
    uploadsByMonth: uploadsByMonth(history.dates, now),
    videos,
    lengthMix,
    engagement: {
      medianViews,
      averageViews: views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : null,
      viewsPerSubscriber: medianViews !== null && profile.subscribers ? Math.round((medianViews / profile.subscribers) * 100) / 100 : null,
      likesPer1kViews: perThousand(videos, (v) => v.likes),
      commentsPer1kViews: perThousand(videos, (v) => v.comments),
    },
    mostLiked: top((v) => v.likes),
    mostCommented: top((v) => v.comments),
    topTags: Array.from(tagCounts.values())
      .filter((t) => t.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
  };
}
