import { NextResponse } from 'next/server';
import { z } from 'zod';
import { describeThumbnail, isAllowedThumbnailUrl } from '@/lib/youtube/analysis/thumbnails';
import { writeLessons } from '@/lib/youtube/audit/ai/lessons';
import { buildChannelOverview, fetchChannelProfile, fetchUploadHistory } from '@/lib/youtube/audit/channel-overview';
import { detectReportLanguage } from '@/lib/youtube/audit/language';
import { MIN_GROUP, auditChannel, thumbnailSplit, type RankedVideo } from '@/lib/youtube/audit/channel-audit';
import { fetchChannelVideos } from '@/lib/youtube/audit/fetch';
import { resolveTarget } from '@/lib/youtube/audit/resolve';
import { sortFindings } from '@/lib/youtube/audit/video-audit';
import { fetchChannelByHandle, fetchChannelsById } from '@/lib/youtube/data-client';
import { toPublicChannel } from '@/lib/youtube/discover/discovery';
import { UserFacingError } from '@/lib/youtube/errors';
import { mapLimit } from '@/lib/youtube/fetcher';
import { consumeQuota } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const bodySchema = z.object({ channel: z.string().trim().min(1).max(300), language: z.enum(['English', 'Bangla']).optional() });

/** Uploads read for a channel audit (about 4 quota units; the overview adds 1 plus 1 per 50 uploads, up to 1,000). */
const VIDEOS = 100;

const FALLBACK = {
  English: { often: 'This channel produces standouts often.', rare: 'This channel’s views are steady; standouts are rare.', unknown: 'Too few of this channel’s videos could be compared to read its patterns.' },
  Bangla: { often: 'এই চ্যানেল প্রায়ই ব্যতিক্রমী ভালো ভিডিও বানায়।', rare: 'এই চ্যানেলের ভিউ স্থির; ব্যতিক্রমী ভালো ভিডিও কম।', unknown: 'এই চ্যানেলের যথেষ্ট ভিডিও তুলনা করা যায়নি, তাই ধরন বোঝা যাচ্ছে না।' },
} as const;

/**
 * POST /api/youtube/audit/channel — what works on any public channel: its standouts vs its
 * weakest videos, thumbnails, rhythm, and how it compares with yours (streamed; credits up
 * front, refunded on failure). Nothing about the channel is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Paste a YouTube channel link or @handle.' }, { status: 400 });
  const target = resolveTarget(parsed.data.channel);
  if (!target || target.kind === 'video') return NextResponse.json({ error: 'That doesn’t look like a YouTube channel link or @handle.', code: 'bad_link' }, { status: 400 });

  return streamAnalysis<'connect' | 'channel' | 'videos' | 'analyze' | 'thumbnails' | 'lessons' | 'done'>({
    userId,
    feature: 'audit',
    label: 'audit/channel',
    cost: (s) => s.audit.channelAuditCreditCost,
    reserve: async ({ audit }) =>
      (await consumeQuota(`audit:user:${userId}`, 1, audit.runsPerUserDay)) ? null : `You’ve reached today’s limit of ${audit.runsPerUserDay} analyses. It resets tomorrow.`,
    run: async ({ token, settings, onStage }) => {
      onStage('channel');
      const identity = target.kind === 'channel' ? (await fetchChannelsById(token.accessToken, [target.channelId]))[0] : await fetchChannelByHandle(token.accessToken, target.handle);
      if (!identity) throw new UserFacingError('YouTube didn’t return this channel. Check the link. Your credits were returned.');
      const channel = toPublicChannel(identity);
      const isOwn = channel.id === token.connection.channelId;

      onStage('videos');
      // The profile and upload history only add the overview: if they fail, the audit still runs.
      const [videos, mine, profile, history] = await Promise.all([
        fetchChannelVideos(token.accessToken, channel.id, VIDEOS),
        isOwn ? Promise.resolve(null) : fetchChannelVideos(token.accessToken, token.connection.channelId, 50).catch(() => null),
        fetchChannelProfile(token.accessToken, channel.id).catch(() => null),
        fetchUploadHistory(token.accessToken, channel.id).catch(() => null),
      ]);
      if (videos.length === 0) throw new UserFacingError('This channel has no public videos to analyze. Your credits were returned.');

      // Written in the language this channel works in.
      const language = parsed.data.language ?? detectReportLanguage([channel.title, ...videos.slice(0, 30).map((v) => v.title)], [profile?.language, identity.defaultLanguage]);

      onStage('analyze');
      const now = new Date();
      const result = auditChannel(channel, videos, now, mine);
      const overview = profile && history ? buildChannelOverview(profile, history, videos, now) : null;
      if (!overview) result.limitations.push('The channel overview could not be loaded this time.');

      // Thumbnails of the long-form standouts vs the weakest (Shorts are found by swiping).
      onStage('thumbnails');
      const half = Math.floor(settings.audit.maxThumbnails / 2);
      const pick = (list: RankedVideo[]) => list.filter((v) => v.format === 'video' && isAllowedThumbnailUrl(v.thumbnailUrl)).slice(0, half);
      const [top, weak] = [pick(result.standouts), pick(result.weakest)];
      if (top.length >= MIN_GROUP && weak.length >= MIN_GROUP) {
        const described = await mapLimit([...top, ...weak], 4, async (v) => ({ id: v.id, f: (await describeThumbnail(v.thumbnailUrl as string, settings.visionModels))?.findings ?? null }));
        const of = (list: RankedVideo[]) => list.flatMap((v) => described.find((d) => d.id === v.id)?.f ?? []);
        result.findings.push(...thumbnailSplit(of(top), of(weak)));
        sortFindings(result.findings);
      } else {
        result.limitations.push('Too few long-form standouts and weak videos to compare thumbnails.');
      }

      onStage('lessons');
      const f = FALLBACK[language];
      const fallback = result.stats.hitRate === null || result.stats.judged < 6 ? f.unknown : result.stats.hitRate >= 0.15 ? f.often : f.rare;
      const { verdict, lessons } = await writeLessons({ subject: 'channel', fallback, label: 'not_comparable', findings: result.findings, themes: [], language, models: settings.textModels });

      return { ...result, overview, isOwn, verdict, lessons };
    },
  });
}
