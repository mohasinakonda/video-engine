import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeLessons } from '@/lib/youtube/audit/ai/lessons';
import { compareContext, compareVideos } from '@/lib/youtube/audit/compare';
import { resolveTarget } from '@/lib/youtube/audit/resolve';
import { runVideoAudit } from '@/lib/youtube/audit/run-video';
import { compareCost } from '@/lib/youtube/audit/pricing';
import { UserFacingError } from '@/lib/youtube/errors';
import { consumeQuota } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 240;

const bodySchema = z.object({
  yours: z.string().trim().min(1).max(300),
  theirs: z.string().trim().min(1).max(300),
  language: z.enum(['English', 'Bangla']).optional(),
});

const FALLBACK = { English: 'Here is how the two videos compare, each against its own channel’s usual.', Bangla: 'দুটো ভিডিও পাশাপাশি, প্রতিটি তার নিজের চ্যানেলের স্বাভাবিকের সাথে তুলনা করে।' } as const;

/**
 * POST /api/youtube/audit/compare — your video next to another one (streamed; two video audits'
 * worth of credits up front, refunded on failure). Nothing about either video is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Paste two YouTube video links.' }, { status: 400 });
  const [yours, theirs] = [resolveTarget(parsed.data.yours), resolveTarget(parsed.data.theirs)];
  if (yours?.kind !== 'video' || theirs?.kind !== 'video') return NextResponse.json({ error: 'Both links need to be YouTube videos.', code: 'bad_link' }, { status: 400 });
  if (yours.videoId === theirs.videoId) return NextResponse.json({ error: 'Pick two different videos.', code: 'same_video' }, { status: 400 });

  return streamAnalysis<'connect' | 'yours' | 'theirs' | 'compare' | 'done'>({
    userId,
    feature: 'audit',
    label: 'audit/compare',
    cost: (s) => compareCost(s.audit),
    // Two videos count as two analyses against the daily cap.
    reserve: async ({ audit }) =>
      (await consumeQuota(`audit:user:${userId}`, 2, audit.runsPerUserDay)) ? null : `You’ve reached today’s limit of ${audit.runsPerUserDay} analyses. It resets tomorrow.`,
    run: async ({ token, settings, onStage }) => {
      const base = { accessToken: token.accessToken, myChannelId: token.connection.channelId, settings, withLessons: false };
      onStage('yours');
      // Written in the language of the creator's own channel.
      const mine = await runVideoAudit({ ...base, language: parsed.data.language, videoId: yours.videoId });
      if (!mine.isOwn) throw new UserFacingError('The first video needs to be one of yours (on your connected channel). Your credits were returned.');
      const language = mine.language;
      onStage('theirs');
      const other = await runVideoAudit({ ...base, language, videoId: theirs.videoId });

      onStage('compare');
      const { rows, differences } = compareVideos(mine, other);
      const { verdict, lessons } = await writeLessons({
        subject: 'compare',
        fallback: FALLBACK[language],
        label: 'not_comparable',
        findings: [
          ...compareContext(mine, other),
          ...differences,
          ...mine.findings.filter((f) => f.kind === 'weakness').map((f) => ({ ...f, statement: `Yours: ${f.statement}` })),
        ],
        // Whose viewers said what must be explicit, or the model mixes them up.
        themes: [
          ...(mine.viewers?.themes ?? []).map((t) => ({ ...t, theme: `Your viewers: ${t.theme}` })),
          ...(other.viewers?.themes ?? []).map((t) => ({ ...t, theme: `Their viewers: ${t.theme}` })),
        ],
        language,
        models: settings.textModels,
      });
      return { yours: mine, theirs: other, rows, differences, verdict, lessons };
    },
  });
}
