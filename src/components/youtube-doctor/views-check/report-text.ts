/**
 * The whole views check as plain text, for pasting into ChatGPT, Claude or any chat AI.
 * It opens with instructions so the AI explains it to the creator in simple Bangla.
 */
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import type { HealthBandId, ScorePart } from '@/lib/youtube/views-check/types';
import { CAUSE, PROBLEMS, STOP_LINE } from './styles';
import { num, pct } from './format';

const BAND_LABEL: Record<HealthBandId, string> = { excellent: 'Great', healthy: 'Good', average: 'Okay', weak: 'Needs work', critical: 'Fix now' };

/** Videos listed one by one; the rest are only counted. */
const MAX_VIDEOS = 30;

const PROMPT = `You are a friendly YouTube Shorts coach for a Bangladeshi creator.
Below is my channel's views check report from Rendoza. Please:
1. Explain it to me in simple Bangla (বাংলা), like talking to a friend. Keep YouTube words like "Shorts", "views", "swipe" in English where that is easier.
2. Start with my main problem in 2–3 lines: why my views are low.
3. Then tell me exactly what to do on my next 3 Shorts, step by step.
4. Explain each score in one or two lines: what it means and if I should worry.
5. Don't use hard terms. If you must, explain them in Bangla.
6. Only use the numbers in this report. Don't guess things that aren't here.
After that, answer my questions in Bangla.`;

function score(name: string, value: number | null, band: HealthBandId | null, provisional = false): string {
  if (value === null || band === null) return `${name}: no score yet (not enough data)`;
  return `${name}: ${value}/100 (${BAND_LABEL[band]})${provisional ? ' – early read, few Shorts' : ''}`;
}

function parts(list: ScorePart[]): string[] {
  return list.map((p) => `  - ${p.name}: ${p.score}/100 – ${p.text}`);
}

export function reportText(result: ViewsCheckResult, analyzedAt: string): string {
  const { report, wording, channel, period } = result;
  const { health, distribution, account, outlook } = report;
  const out: string[] = [PROMPT, '', '==== MY REPORT ===='];

  out.push(`Channel: ${channel.title}${channel.subscriberCount !== null ? ` (${num(channel.subscriberCount)} subscribers)` : ''}`);
  out.push(`Checked: last ${period.days} days, ${report.verdict.basedOn} videos, on ${new Date(analyzedAt).toLocaleDateString('en-GB')}`);
  out.push('Scores: 85+ Great, 70–84 Good, 55–69 Okay, 40–54 Needs work, under 40 Fix now. 70 = at a good level.');

  out.push('', '## Main problem', wording.headline);
  if (wording.explanation) out.push(wording.explanation);

  if (wording.plan.length > 0) {
    out.push('', '## What to do this week');
    wording.plan.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  }

  out.push('', '## Scores');
  out.push(score('Video quality (do viewers stay and watch?)', health.score, health.band, health.provisional));
  out.push(`  ${health.headline} ${health.detail}`.trimEnd());
  out.push(...parts(health.parts));
  if (health.trend)
    out.push(`  - Trend: last ${health.trend.recentCount} Shorts score ${health.trend.recent}, the ${health.trend.previousCount} before scored ${health.trend.previous}`);

  out.push(score('YouTube reach (is YouTube showing my Shorts? shadowban check)', distribution.score, distribution.band, distribution.provisional));
  out.push(`  ${distribution.headline} ${distribution.detail}`.trimEnd());
  out.push(...parts(distribution.parts));

  out.push(score('Channel safety (any strike, block or restriction?)', account.score, account.band));
  out.push(`  ${account.headline} ${account.detail}`.trimEnd());
  for (const issue of account.issues) {
    const where = issue.videos.length > 0 ? ` On: ${issue.videos.map((v) => `"${v.title}"`).join(', ')}.` : '';
    out.push(`  - ${issue.title} (−${issue.points}): ${issue.detail}${where} Fix: ${issue.fix}`);
  }

  out.push('', '## Will my Shorts grow?', outlook.title, outlook.detail);
  if (outlook.content.medianSwipeAway !== null) out.push(`- Swiped away in the first 2 seconds: ${pct(outlook.content.medianSwipeAway)} (good: under 45%)`);
  if (outlook.content.medianViewPct !== null) out.push(`- Watched (average % of the Short): ${Math.round(outlook.content.medianViewPct)}%`);
  if (outlook.reach.change !== null) out.push(`- Newest Shorts get ${Math.round((outlook.reach.change - 1) * 100)}% views compared with the ones before`);
  out.push(`- Next step: ${outlook.nextStep}`);

  const stops = report.stopPoints?.filter((s) => s.count > 0 && s.gate !== 'unknown') ?? [];
  if (stops.length > 0) {
    out.push('', '## Where my Shorts stop');
    for (const s of stops) out.push(`- ${s.count} Shorts: ${STOP_LINE[s.gate as keyof typeof STOP_LINE].what}`);
  }

  if (report.topics?.length > 0) {
    out.push('', '## My topics (best first)');
    for (const t of report.topics) {
      const views = t.medianViews !== null ? `typical ${num(t.medianViews)} views` : 'too new';
      const swipe = t.medianSwipeAway !== null ? `, ${pct(t.medianSwipeAway)} swiped away` : '';
      out.push(`- ${t.name}: ${t.shorts} Shorts, ${views}${swipe}`);
    }
  }

  if (report.videos.length > 0) {
    const sorted = [...report.videos].sort((a, b) => Number(PROBLEMS.has(b.cause)) - Number(PROBLEMS.has(a.cause)));
    out.push('', `## Each video (${report.videos.length})`);
    for (const v of sorted.slice(0, MAX_VIDEOS)) {
      const views = v.lifetimeViews !== null ? `${num(v.lifetimeViews)} views` : 'views unknown';
      out.push(`- "${v.title}" – ${views} – ${CAUSE[v.cause].label}`);
      if (v.reason) out.push(`  Why: ${v.reason}`);
      if (v.evidence.length > 0) out.push(`  Numbers: ${v.evidence.join('; ')}`);
      if (v.fix) out.push(`  Fix: ${v.fix}`);
    }
    if (report.videos.length > MAX_VIDEOS) out.push(`- …and ${report.videos.length - MAX_VIDEOS} more videos`);
  }

  if (report.limitations.length > 0) {
    out.push('', '## What YouTube doesn’t share (not in this report)');
    for (const l of report.limitations) out.push(`- ${l}`);
  }

  return out.join('\n');
}
