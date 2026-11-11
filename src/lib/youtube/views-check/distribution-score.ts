/**
 * The distribution score: is YouTube showing the channel's Shorts? Pure.
 *
 *   score = weighted mean of the parts, each min(100, 70 × value ÷ line), 70 = at the line:
 *   shown    (40%): share of the newest judged Shorts that got into the Shorts feed (line 90%)
 *   momentum (35%): newest Shorts' views ÷ the ones before, from the growth outlook (line 1 = same)
 *   feed     (25%): median share of views from the Shorts feed (line 70%)
 *
 * Blocked Shorts are left out: they are an account problem, scored in the account health.
 * Missing parts are left out (weights shared), never counted as 0.
 */
import { median } from '../analysis/stats';
import { bandOf } from './channel-health';
import { VIEWS_RULES as R } from './rules-config';
import type { DistributionPartId, DistributionScore, GrowthOutlook, ScorePart, ShortTimeline, VideoFinding } from './types';

const D = R.distribution;
const AT = R.health.atLine;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const partScore = (value: number, line: number) => Math.max(0, Math.min(100, (AT * value) / line));

const NAMES: Record<DistributionPartId, string> = {
  shown: 'Reached the Shorts feed',
  momentum: 'Views trend',
  feed: 'Views from the Shorts feed',
};
const PROBLEM: Record<DistributionPartId, string> = {
  shown: 'YouTube is keeping some of your Shorts out of the feed.',
  momentum: 'Your newest Shorts get fewer views than your older ones.',
  feed: 'Few of your views come from the Shorts feed.',
};

/**
 * `findings`: the channel's videos, newest first. `timelines`: its judged Shorts.
 * `reach`: the growth outlook's comparison of the newest Shorts with the ones before.
 */
export function distributionScore(findings: VideoFinding[], timelines: ShortTimeline[], reach: GrowthOutlook['reach']): DistributionScore {
  const judged = findings.filter((f) => f.format === 'short' && f.cause !== 'too_new' && f.cause !== 'unknown' && f.cause !== 'blocked').slice(0, D.maxShorts);
  if (judged.length < D.minShorts) {
    return {
      score: null,
      band: null,
      provisional: true,
      shorts: judged.length,
      parts: [],
      headline: 'Not enough data for a score yet.',
      detail: `We need at least ${D.minShorts} Shorts that are 3+ days old; you have ${judged.length}.`,
    };
  }

  const parts: ScorePart<DistributionPartId>[] = [];
  const unseen = judged.filter((f) => f.cause === 'not_shown' || f.cause === 'not_in_feed').length;
  const shown = (judged.length - unseen) / judged.length;
  parts.push({
    id: 'shown',
    name: NAMES.shown,
    weight: D.weights.shown,
    score: partScore(shown, D.lines.shown),
    text: `${unseen === 0 ? 'all ' : ''}${judged.length - unseen} of your last ${judged.length} Shorts reached the Shorts feed (good: ${Math.round(D.lines.shown * 10)} in 10 or more)`,
  });

  if (reach.state !== 'unknown') {
    const change = reach.change ?? (reach.state === 'rising' ? Infinity : 1);
    const by = reach.by === 'first_day' ? 'views on day 1' : 'views';
    const diff = Number.isFinite(change) ? Math.round((change - 1) * 100) : null;
    parts.push({
      id: 'momentum',
      name: NAMES.momentum,
      weight: D.weights.momentum,
      score: partScore(Number.isFinite(change) ? change : 2, D.lines.momentum),
      text:
        diff === null
          ? `your newest Shorts get ${by}; the ones before got none`
          : `your newest ${reach.recent?.count ?? ''} Shorts get ${Math.abs(diff)}% ${diff >= 0 ? 'more' : 'fewer'} ${by} than the ${reach.previous?.count ?? ''} before (good: the same or more)`.replace(
              / {2,}/g,
              ' ',
            ),
    });
  }

  const feedShares = timelines
    .slice(0, D.maxShorts)
    .map((t) => t.shortsFeedShare)
    .filter((v): v is number => v !== null);
  if (feedShares.length >= D.minFeedShorts) {
    const feed = median(feedShares) as number;
    parts.push({
      id: 'feed',
      name: NAMES.feed,
      weight: D.weights.feed,
      score: partScore(feed, D.lines.feed),
      text: `${pct(feed)} of a typical Short’s views come from the Shorts feed (good: ${pct(D.lines.feed)}+)`,
    });
  }

  const weight = parts.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(parts.reduce((s, p) => s + p.weight * p.score, 0) / weight);
  for (const p of parts) p.score = Math.round(p.score);
  const costly = parts.filter((p) => p.score < AT).sort((a, b) => b.weight * (AT - b.score) - a.weight * (AT - a.score))[0];

  return {
    score,
    band: bandOf(score),
    provisional: judged.length < D.confidentShorts,
    shorts: judged.length,
    parts,
    headline: costly ? PROBLEM[costly.id] : 'Not shadowbanned: YouTube is showing your Shorts.',
    detail: `${parts.find((p) => p.id === costly?.id)?.text ?? parts[0].text}.`.replace(/^./, (c) => c.toUpperCase()),
  };
}
