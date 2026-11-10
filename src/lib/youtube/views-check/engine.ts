/**
 * The views check: why recent videos get (almost) no views, and why Shorts stop after a first
 * burst. Pure functions over a ViewsCheckDataset; every finding states the numbers it used.
 */
import { normalizeRetention, watchRatioAt } from '../analysis/retention';
import { median } from '../analysis/stats';
import { titleSimilarity } from '../create/topic-landscape';
import type { VideoMeta } from '../types';
import { videoRange } from './period';
import { VIEWS_RULES as R } from './rules-config';
import { channelStage } from './stage';
import { shortTest, testAgreement, testRounds } from './test-score';
import { gatesFor, isHighSwipe, newTopicJudgement, stopPointOf, topicIndex, topicSummaries } from './insights';
import type {
  ChannelSignal,
  ShortTest,
  ShortTimeline,
  StudioCheck,
  VideoFinding,
  VideoStatus,
  ViewsCause,
  ViewsCheckDataset,
  ViewsCheckReport,
} from './types';

const DAY = 86_400_000;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

/** Most severe first; the order findings and verdicts are ranked in. */
const SEVERITY: ViewsCause[] = ['blocked', 'not_shown', 'not_in_feed', 'not_clicked', 'new_topic', 'weak_hook', 'left_early', 'quick_stop', 'unknown', 'too_new', 'ok'];

export function formatOf(video: VideoMeta): 'short' | 'video' {
  if (video.format) return video.format;
  return video.durationSec !== null && video.durationSec <= R.shortMaxSec ? 'short' : 'video';
}

function reportedDays(video: VideoMeta, data: ViewsCheckDataset): number {
  return videoRange(video.publishedAt, data.period)?.days ?? 0;
}

// ─── Per video ─────────────────────────────────────────────────────────────────

type Judgement = Pick<VideoFinding, 'cause' | 'reason' | 'evidence' | 'fix'>;

function judgeAvailability(status: VideoStatus | undefined, kidsChannel: boolean): Judgement | null {
  if (!status) return null;
  if (status.uploadStatus === 'rejected') {
    const why = status.rejectionReason ?? 'unknown';
    const fix =
      why === 'duplicate'
        ? 'Don’t upload the same file again; publish a new, original video.'
        : why === 'claim' || why === 'copyright'
          ? 'Remove the copyrighted material (often music or clips) and upload a new version.'
          : 'Open the video in Studio to see the rejection details and upload a corrected version.';
    return { cause: 'blocked', reason: 'YouTube rejected this upload.', evidence: [`Rejection reason: ${why}`], fix };
  }
  if (status.uploadStatus === 'failed') {
    return {
      cause: 'blocked',
      reason: 'The upload failed, so the video can’t play.',
      evidence: [`Failure reason: ${status.failureReason ?? 'unknown'}`],
      fix: 'Upload the file again, exported as MP4 (H.264 video, AAC audio).',
    };
  }
  if (status.privacyStatus && status.privacyStatus !== 'public') {
    return {
      cause: 'blocked',
      reason: `The video is ${status.privacyStatus}, so YouTube doesn’t show it to anyone.`,
      evidence: [`Visibility: ${status.privacyStatus}`],
      fix: 'Set visibility to Public in Studio if it should get views.',
    };
  }
  if (status.regionAllowed && status.regionAllowed.length === 0) {
    return {
      cause: 'blocked',
      reason: 'The video is blocked in every country.',
      evidence: ['Allowed countries: none'],
      fix: 'Open Copyright in Studio for this video: a claim is usually the cause. Remove the claimed part or trim a Short under 60 seconds.',
    };
  }
  if (status.ageRestricted) {
    return {
      cause: 'blocked',
      reason: 'The video is age-restricted, so most viewers can’t see it and it isn’t recommended widely.',
      evidence: ['Age restriction: on'],
      fix: 'Check the restriction in Studio; edit the video or appeal if you think it’s wrong.',
    };
  }
  if (status.madeForKids && !kidsChannel) {
    return {
      cause: 'blocked',
      reason: 'The video is marked Made for Kids, which turns off comments, the notification bell and end screens.',
      evidence: ['Audience: Made for Kids'],
      fix: 'If the video isn’t for children, change the audience setting in Studio.',
    };
  }
  return null;
}

function judgeLong(video: VideoMeta, data: ViewsCheckDataset, days: number): Judgement {
  const views = data.perVideo.ok ? (data.perVideo.data[video.id]?.views ?? 0) : null;
  const reach = data.reach.ok && data.reach.data.coveredDays >= R.minReportedDays ? data.reach.data : null;
  const stats = reach?.byVideo[video.id];
  const impressions = reach ? (stats?.impressions ?? 0) : null;

  if (impressions !== null && impressions <= R.notShown.maxImpressions) {
    return {
      cause: 'not_shown',
      reason: 'YouTube hasn’t shown this video to anyone yet: no impressions.',
      evidence: [`0 impressions in ${plural(days, 'reported day')}`, ...(views !== null ? [`${plural(views, 'view')} in the period`] : [])],
      fix: 'Check the Studio items below. If nothing is flagged, make the next video clearly original and search-led.',
    };
  }
  if (impressions !== null && impressions >= R.packaging.minImpressions && stats?.ctr !== null && stats?.ctr !== undefined && stats.ctr < R.packaging.lowCtr) {
    return {
      cause: 'not_clicked',
      reason: 'People see this video but almost nobody clicks.',
      evidence: [`${count(impressions)} impressions`, `CTR ${(stats.ctr * 100).toFixed(1)}% (half of channels sit between 2% and 10%)`],
      fix: 'Rebuild the title and thumbnail around one clear promise, with the search phrase first.',
    };
  }
  const retention = data.deepDives[video.id]?.retention;
  if (retention?.ok && video.durationSec) {
    const points = normalizeRetention(retention.data);
    const at30 = watchRatioAt(points, Math.min(1, R.opening.earlyExitSec / video.durationSec));
    const relatives = points.map((p) => p.relativePerformance).filter((v): v is number => v !== null);
    const relative = relatives.length ? relatives.reduce((a, b) => a + b, 0) / relatives.length : null;
    if ((at30 !== null && at30 < R.opening.earlyExitWatchRatio) || (relative !== null && relative < R.opening.weakRelative)) {
      return {
        cause: 'left_early',
        reason: 'Viewers click, then leave early.',
        evidence: [
          ...(at30 !== null ? [`${pct(Math.min(1, at30))} still watching at ${R.opening.earlyExitSec} seconds`] : []),
          ...(relative !== null ? [`Retention vs similar videos: ${relative.toFixed(2)} (0.5 is typical)`] : []),
        ],
        fix: 'Open with the payoff: restate the title’s promise in the first seconds and cut the intro.',
      };
    }
  }
  // With few views YouTube often returns no retention curve, but the average % viewed still tells
  // whether people who clicked stayed.
  const watched = data.perVideo.ok ? (data.perVideo.data[video.id]?.avgViewPct ?? null) : null;
  if (!retention?.ok && watched !== null && watched < R.opening.longWeakAvgViewPct) {
    const avgSec = data.perVideo.ok ? data.perVideo.data[video.id]?.avgViewDurationSec : null;
    return {
      cause: 'left_early',
      reason: 'Viewers click, then leave early.',
      evidence: [
        `Watched ${Math.round(watched)}% of the video on average${avgSec && video.durationSec ? ` (${Math.round(avgSec)}s of ${clock(video.durationSec)})` : ''}`,
        ...(views !== null ? [`${plural(views, 'view')} in the period`] : []),
      ],
      fix: 'Open with the payoff: restate the title’s promise in the first seconds and cut the intro.',
    };
  }
  // Without impressions we can't tell whether YouTube showed it and nobody clicked, or barely showed
  // it at all: that is missing data, not "no problem".
  if (impressions === null) {
    return {
      cause: 'unknown',
      reason:
        (views ?? 0) === 0
          ? 'No views, and YouTube hasn’t shared impressions for this video yet.'
          : 'YouTube hasn’t shared impressions and click-through for this channel yet, so we can’t tell whether it was barely shown or shown and skipped.',
      evidence: ['Impressions: not available yet', ...(views !== null ? [`${plural(views, 'view')} in the period`] : [])],
      fix: 'Check this video’s Reach tab in Studio (impressions and click-through rate). YouTube usually starts sharing them a few days after you connect; run the check again then.',
    };
  }
  return { cause: 'ok', reason: 'No distribution problem found.', evidence: views !== null ? [`${plural(views, 'view')} in the period`] : [], fix: '' };
}

/** 0:07, 1:05 */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function shortTimeline(video: VideoMeta, data: ViewsCheckDataset): ShortTimeline {
  const O = R.opening;
  const dive = data.deepDives[video.id];
  const daily = dive?.daily.ok ? dive.daily.data : null;
  const views = data.perVideo.ok ? (data.perVideo.data[video.id]?.views ?? 0) : (daily?.reduce((s, d) => s + d.views, 0) ?? 0);
  const dailyTotal = daily?.reduce((s, d) => s + d.views, 0) ?? 0;
  const firstDaysShare = daily && dailyTotal > 0 ? daily.slice(0, R.quickStop.firstDays).reduce((s, d) => s + d.views, 0) / dailyTotal : null;
  const traffic = dive?.traffic.ok ? dive.traffic.data : null;
  const trafficTotal = traffic?.reduce((s, t) => s + t.views, 0) ?? 0;
  const shortsFeedShare = traffic && trafficTotal > 0 ? (traffic.find((t) => t.source === 'SHORTS')?.views ?? 0) / trafficTotal : null;

  // Engaged ÷ views over the same days: the per-day series when we have it, else the period totals.
  const dailyEngaged = daily?.reduce((s, d) => s + d.engagedViews, 0) ?? 0;
  const engagedRate =
    daily && dailyTotal > 0
      ? Math.min(1, dailyEngaged / dailyTotal)
      : data.engaged.ok && data.engaged.data[video.id] !== undefined && views > 0
        ? Math.min(1, data.engaged.data[video.id] / views)
        : null;

  // YouTube's audienceWatchRatio: a share of all views, as YouTube Studio draws it (it starts above
  // 100% when people rewatch). Everything shown uses this scale, so numbers match Studio.
  const retention = dive?.retention.ok ? normalizeRetention(dive.retention.data) : [];
  const relatives = retention.map((p) => p.relativePerformance).filter((v): v is number => v !== null);
  const start = retention[0]?.watchRatio ?? 0;
  const duration = video.durationSec;
  let halfGoneAtSec: number | null = null;
  let biggestDrop: ShortTimeline['biggestDrop'] = null;
  let completion: ShortTimeline['completion'] = null;
  let exitWindow: ShortTimeline['exitWindow'] = null;
  if (retention.length > 1) {
    const end = watchRatioAt(retention, O.completionAtRatio);
    if (end !== null) completion = { ofViews: end, ofStarted: start > 0 ? end / start : end };
  }
  // Only when most plays are still there at the curve's first point; otherwise they left at once.
  if (retention.length > 1 && duration && start >= O.openingHeldShare) {
    // When the leaving starts (10% of the opening audience gone) and when half of them are gone.
    const from = retention.find((p) => p.watchRatio <= start * O.exitStartShare);
    const to = retention.find((p) => p.watchRatio <= start * 0.5);
    if (from) exitWindow = { fromSec: from.ratio * duration, toSec: to ? to.ratio * duration : null };
  }
  if (retention.length > 1 && duration) {
    const half = retention.find((p) => p.watchRatio < 0.5);
    halfGoneAtSec = half ? half.ratio * duration : null;
    for (let i = 1; i < retention.length; i++) {
      if (retention[i].ratio < O.ignoreStartRatio) continue;
      const lost = retention[i - 1].watchRatio - retention[i].watchRatio;
      if (lost > 0 && (!biggestDrop || lost > biggestDrop.lost)) biggestDrop = { atSec: retention[i].ratio * duration, lost };
    }
  }
  const stats = data.perVideo.ok ? data.perVideo.data[video.id] : undefined;
  return {
    videoId: video.id,
    title: video.title,
    views,
    firstDaysShare,
    shortsFeedShare,
    engagedRate,
    estSwipeAway: engagedRate === null ? null : 1 - engagedRate,
    channelMedianSwipeAway: null,
    durationSec: duration,
    avgViewSec: stats?.avgViewDurationSec ?? null,
    avgViewPct: stats?.avgViewPct ?? null,
    completion,
    exitWindow,
    halfGoneAtSec,
    biggestDrop,
    day1Views: daily?.[0]?.views ?? null,
    day2Views: daily?.[1]?.views ?? null,
    relativeRetention: relatives.length ? relatives.reduce((a, b) => a + b, 0) / relatives.length : null,
    likeRate: video.likes !== null && video.lifetimeViews ? video.likes / video.lifetimeViews : null,
    interactions: data.interactions.ok ? (data.interactions.data[video.id] ?? { likes: 0, comments: 0, shares: 0 }) : null,
    daily: daily?.map(({ date, views: v }) => ({ date, views: v })) ?? [],
    curve: sampleCurve(retention),
  };
}

/** At most 40 evenly spaced points of a retention curve, for the chart. */
function sampleCurve(points: { ratio: number; watchRatio: number }[]): ShortTimeline['curve'] {
  const step = Math.max(1, Math.ceil(points.length / 40));
  const out = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  return out.map((p) => ({ at: Math.round(p.ratio * 1000) / 1000, watching: Math.round(p.watchRatio * 1000) / 1000 }));
}

/** The numbers every Short finding shows, so no finding reads as generic advice. */
function shortEvidence(t: ShortTimeline): string[] {
  const out: string[] = [];
  if (t.estSwipeAway !== null) {
    const vs = t.channelMedianSwipeAway !== null ? ` (your Shorts’ median: ${pct(t.channelMedianSwipeAway)})` : '';
    out.push(`About ${pct(t.estSwipeAway)} of plays swiped away in the first seconds (estimate; ≈${pct(1 - t.estSwipeAway)} stayed to watch)${vs}`);
  }
  if (t.avgViewSec !== null && t.durationSec) out.push(`Watched ${Math.round(t.avgViewSec)}s of ${Math.round(t.durationSec)}s on average`);
  else if (t.avgViewPct !== null) out.push(`Average viewed: ${Math.round(t.avgViewPct)}%`);
  if (t.halfGoneAtSec !== null) out.push(`Half the viewers gone by ${clock(t.halfGoneAtSec)}`);
  if (t.biggestDrop && t.biggestDrop.lost >= 0.05) out.push(`Biggest drop at ${clock(t.biggestDrop.atSec)} (${pct(t.biggestDrop.lost)} of viewers left there)`);
  if (t.relativeRetention !== null) out.push(`Retention vs similar Shorts: ${t.relativeRetention.toFixed(2)} (0.5 is typical)`);
  return out;
}

/** Up to two concrete changes for the next Short, from where and when viewers left. */
function shortFix(t: ShortTimeline): string {
  const O = R.opening;
  const steps: string[] = [];
  const w = t.exitWindow;
  // Leaving spread over a stretch after the opening; a single cliff is named as the biggest drop below.
  const lateExit = w !== null && w.fromSec > O.hookSec && (w.toSec === null || w.toSec - w.fromSec >= 1);
  if (lateExit) {
    steps.push(
      `Viewers stay through the opening, then most leave ${w.toSec !== null ? `between ${clock(w.fromSec)} and ${clock(w.toSec)}` : `from ${clock(w.fromSec)}`}: look at what’s on screen then, and show the payoff before ${clock(w.fromSec)}.`
    );
  } else if ((t.halfGoneAtSec !== null && t.halfGoneAtSec <= O.instantExitSec) || (t.estSwipeAway !== null && t.estSwipeAway >= O.highSwipeAway)) {
    steps.push('Viewers decide in the first 1–2 seconds: open on the finished result or the most surprising moment, with no setup, logo or intro.');
  }
  const dropInWindow = lateExit && t.biggestDrop !== null && w.toSec !== null && t.biggestDrop.atSec >= w.fromSec && t.biggestDrop.atSec <= w.toSec;
  if (!dropInWindow && t.biggestDrop && t.biggestDrop.lost >= 0.05 && t.biggestDrop.atSec > O.instantExitSec) {
    steps.push(`Most viewers left at ${clock(t.biggestDrop.atSec)}: cut or speed up what happens there.`);
  }
  if (t.avgViewSec !== null && t.durationSec && t.durationSec >= t.avgViewSec * 2 && t.durationSec > 15) {
    const target = Math.max(10, Math.round((t.avgViewSec * 1.3) / 5) * 5);
    steps.push(`People watch about ${Math.round(t.avgViewSec)}s of ${Math.round(t.durationSec)}s: try a ${target}-second version.`);
  }
  return steps.slice(0, 2).join(' ') || 'Change one thing in the next Short (the first second, or the length) and compare it with this one.';
}

function judgeShort(t: ShortTimeline, days: number, shortsJudged: number): Judgement {
  const O = R.opening;
  const { views } = t;
  if (views === 0) {
    return {
      cause: 'not_shown',
      reason: 'This Short hasn’t been shown in the Shorts feed: 0 views.',
      evidence: [`0 views in ${plural(days, 'reported day')}`],
      fix: 'Check Restrictions and Copyright in Studio; if it uses claimed music and is over 60 seconds, trim it under 60.',
    };
  }
  if (t.shortsFeedShare !== null && views >= R.notShown.minViewsForFeedCheck && t.shortsFeedShare <= R.notShown.maxShortsFeedShare) {
    return {
      cause: 'not_in_feed',
      reason: 'This Short isn’t reaching the Shorts feed; its few views come from elsewhere.',
      evidence: [`${plural(views, 'view')}`, `${pct(t.shortsFeedShare)} from the Shorts feed`],
      fix: 'Make it vertical, original and clearly a Short; check Copyright and Restrictions in Studio.',
    };
  }
  if (isHighSwipe(t, shortsJudged)) {
    const usual =
      t.channelMedianSwipeAway !== null && shortsJudged >= O.minShortsForMedian ? ` Your usual Short: about ${pct(t.channelMedianSwipeAway)}.` : '';
    const w = t.exitWindow;
    const where =
      w === null
        ? ''
        : w.fromSec <= O.hookSec
          ? ' Most leave in the first 1–2 seconds.'
          : w.toSec !== null && w.toSec - w.fromSec >= 1
            ? ` They stay through the opening, then most leave between ${clock(w.fromSec)} and ${clock(w.toSec)}.`
            : ` They stay through the opening, then most leave at ${clock(w.fromSec)}.`;
    return {
      cause: 'weak_hook',
      reason: `Weak hook: most people swipe this Short away in the first seconds (about ${pct(t.estSwipeAway as number)} of plays, estimated; ≈${pct(1 - (t.estSwipeAway as number))} stayed to watch), so YouTube stops offering it to new viewers.${where}${usual}`,
      evidence: shortEvidence(t),
      fix: shortFix(t),
    };
  }
  const weakPct = t.avgViewPct !== null && t.avgViewPct < O.shortsWeakAvgViewPct;
  const weakRelative = t.relativeRetention !== null && t.relativeRetention < O.weakRelative;
  if (weakPct || weakRelative) {
    const when = t.biggestDrop && t.biggestDrop.lost >= 0.05 ? ` Most of them leave at ${clock(t.biggestDrop.atSec)}.` : '';
    return {
      cause: 'left_early',
      reason: `People start watching, but leave before the end (average viewed ${t.avgViewPct !== null ? `${Math.round(t.avgViewPct)}%` : 'is low'}).${when}`,
      evidence: shortEvidence(t),
      fix: shortFix(t),
    };
  }
  if (t.firstDaysShare !== null && days >= R.quickStop.minReportedDays && views >= R.quickStop.minViews && t.firstDaysShare >= R.quickStop.firstDaysShare) {
    const held = t.relativeRetention !== null && t.relativeRetention >= 0.5;
    const burst = t.day1Views !== null ? ` Day 1: ${count(t.day1Views)} views${t.day2Views !== null ? `, day 2: ${count(t.day2Views)}` : ''}, then almost none.` : '';
    return {
      cause: 'quick_stop',
      reason: held
        ? `It kept viewers as well as similar Shorts, but lost to the other Shorts competing for the next, wider audience.${burst}`
        : `It got a first burst, then didn’t beat the other Shorts competing for the next audience.${burst}`,
      evidence: [`${pct(t.firstDaysShare)} of its views came in the first ${R.quickStop.firstDays} days`, ...shortEvidence(t), ...(t.likeRate !== null ? [`Likes per view: ${(t.likeRate * 100).toFixed(1)}%`] : [])],
      fix: held
        ? 'The opening works; the next audience needs a stronger reason to stay to the end and react: a payoff in the last seconds and a question viewers want to answer.'
        : shortFix(t),
    };
  }
  return { cause: 'ok', reason: 'No distribution problem found.', evidence: [`${plural(views, 'view')} in the period`, ...shortEvidence(t)], fix: '' };
}

// ─── Channel-wide ──────────────────────────────────────────────────────────────

function channelSignals(data: ViewsCheckDataset, findings: VideoFinding[]): ChannelSignal[] {
  const C = R.channel;
  const signals: ChannelSignal[] = [];
  const recent = data.videos.slice(0, R.recentVideos);
  const now = Date.parse(data.collectedAt);

  const shorts = recent.filter((v) => formatOf(v) === 'short');
  const longs = recent.filter((v) => formatOf(v) === 'video');
  for (const short of shorts) {
    const twin = longs.find((long) => titleSimilarity(short.title, long.title) >= C.doublePostSimilarity);
    if (twin) {
      signals.push({
        id: 'double_post',
        severity: 'medium',
        title: 'The same topic is posted twice, as a Short and a long video',
        detail: `“${short.title}” and “${twin.title}” look like the same video in two formats.`,
        fix: 'One topic, one video: pick the format that fits the footage.',
      });
      break;
    }
  }

  const hashTitles = recent.filter((v) => v.title.includes('#'));
  if (hashTitles.length >= 2) {
    signals.push({
      id: 'hashtags_in_titles',
      severity: 'low',
      title: 'Hashtags inside titles',
      detail: `${hashTitles.length} of your last ${recent.length} titles contain hashtags, which use up the words people search for.`,
      fix: 'Move hashtags to the description; start the title with the search phrase.',
    });
  }

  const avg = (videos: VideoMeta[]) => {
    const views = videos.map((v) => v.lifetimeViews).filter((n): n is number => n !== null);
    return views.length ? views.reduce((a, b) => a + b, 0) / views.length : null;
  };
  const avgShort = avg(shorts);
  const avgLong = avg(longs);
  if (longs.length >= 2 && longs.every((v) => (v.durationSec ?? 0) <= C.shortLongFormSec) && (avgLong ?? 0) < (avgShort ?? Infinity)) {
    signals.push({
      id: 'no_long_videos',
      severity: 'medium',
      title: 'No long video over 4 minutes',
      detail: `All ${longs.length} recent long-form uploads are ${C.shortLongFormSec / 60} minutes or shorter, so there’s little watch time for YouTube to recommend.`,
      fix: 'Make one proper long video a week (8–12 minutes) on a topic people search for.',
    });
  }
  if (avgShort !== null && avgLong !== null && longs.length >= 2 && shorts.length >= 2 && avgShort >= C.formatGapRatio * Math.max(avgLong, 1)) {
    signals.push({
      id: 'format_gap',
      severity: 'medium',
      title: 'Your Shorts get views; your long videos don’t',
      detail: `Shorts average ${count(Math.round(avgShort))} views; long videos average ${count(Math.round(avgLong))}.`,
      fix: 'Keep the Shorts, but rebuild long videos as search-led, longer videos instead of clips.',
    });
  }

  const times = data.videos.map((v) => Date.parse(v.publishedAt)).filter(Number.isFinite).sort((a, b) => b - a);
  if (times.length) {
    const sinceLast = Math.floor((now - times[0]) / DAY);
    const gaps = times.slice(1).map((t, i) => Math.floor((times[i] - t) / DAY));
    const longest = Math.max(0, ...gaps.slice(0, R.recentVideos));
    if (sinceLast >= C.longGapDays || longest >= C.longGapDays) {
      signals.push({
        id: 'upload_gap',
        severity: 'low',
        title: 'Long gaps between uploads',
        detail: sinceLast >= C.longGapDays ? `No upload for ${sinceLast} days.` : `A gap of ${longest} days between recent uploads.`,
        fix: 'Post on a steady schedule you can keep, e.g. 3 Shorts and 1 long video a week.',
      });
    }
    const lastTwoWeeks = data.videos.filter((v) => now - Date.parse(v.publishedAt) <= 14 * DAY);
    if (lastTwoWeeks.length / 14 >= C.highVolumePerDay) {
      let pairs = 0;
      let similar = 0;
      for (let i = 0; i < lastTwoWeeks.length; i++) {
        for (let j = i + 1; j < lastTwoWeeks.length; j++) {
          pairs++;
          if (titleSimilarity(lastTwoWeeks[i].title, lastTwoWeeks[j].title) >= C.doublePostSimilarity) similar++;
        }
      }
      if (pairs && similar / pairs >= C.highVolumeSimilarShare) {
        signals.push({
          id: 'mass_produced_risk',
          severity: 'high',
          title: 'Risk: many similar uploads in a short time',
          detail: `${lastTwoWeeks.length} uploads in 14 days, many with near-identical titles. YouTube limits mass-produced and repetitive content.`,
          fix: 'Post fewer, clearly different videos, each with its own idea and your own voice or footage.',
        });
      }
    }
  }

  const aged = data.videos.filter((v) => v.lifetimeViews !== null && now - Date.parse(v.publishedAt) >= C.suddenDropMinAgeDays * DAY);
  if (aged.length >= 10) {
    const last = median(aged.slice(0, 5).map((v) => v.lifetimeViews as number));
    const before = median(aged.slice(5, 10).map((v) => v.lifetimeViews as number));
    if (last !== null && before !== null && before >= 50 && last <= before * C.suddenDropRatio) {
      signals.push({
        id: 'sudden_drop',
        severity: 'high',
        title: 'Views dropped sharply on recent uploads',
        detail: `Your last 5 videos have a median of ${count(Math.round(last))} views; the 5 before had ${count(Math.round(before))}.`,
        fix: 'Compare what changed (topic, format, length, music, originality) between the two groups and undo it.',
      });
    }
  }

  const judged = findings.filter((f) => f.cause !== 'too_new' && f.cause !== 'unknown' && f.cause !== 'blocked');
  const unseen = judged.filter((f) => f.cause === 'not_shown' || f.cause === 'not_in_feed');
  if (judged.length >= C.wideStopMinVideos && unseen.length / judged.length >= C.wideStopShare) {
    signals.unshift({
      id: 'channel_wide_stop',
      severity: 'high',
      title: 'YouTube isn’t showing your recent uploads',
      detail: `${unseen.length} of your last ${judged.length} judged videos got no impressions or no Shorts-feed views.`,
      fix: 'Check the Studio items below first, then make sure every upload is your own, original work.',
    });
  }

  if (data.perVideo.ok) {
    const rows = Object.values(data.perVideo.data);
    const views = rows.reduce((s, r) => s + r.views, 0);
    const subs = rows.reduce((s, r) => s + (r.subscribersGained ?? 0), 0);
    if (views >= C.minViewsForSubscribeRate && subs / views < C.lowSubscribeRate) {
      signals.push({
        id: 'low_subscribe_rate',
        severity: 'low',
        title: 'Views aren’t turning into subscribers',
        detail: `${plural(subs, 'subscriber')} from ${count(views)} views in the last 90 days.`,
        fix: 'Give viewers a reason to come back: a series, a clear channel promise, and a spoken ask at the end.',
      });
    }
  }
  const withComments = recent.filter((v) => v.comments !== null);
  if (withComments.length >= 5 && withComments.every((v) => v.comments === 0)) {
    signals.push({
      id: 'no_comments',
      severity: 'low',
      title: 'No comments on recent videos',
      detail: `0 comments across your last ${withComments.length} videos.`,
      fix: 'End with a simple question viewers can answer in one word, and reply to every comment.',
    });
  }

  return signals;
}

function studioChecks(hasShorts: boolean): StudioCheck[] {
  const checks: StudioCheck[] = [
    {
      id: 'restrictions',
      title: 'Restrictions on each video',
      where: 'Studio → Content → the Restrictions column',
      why: 'Shows copyright blocks, age restrictions and ad limits that stop a video being shown.',
      ifFound: 'Open the video’s Copyright section; remove or replace the claimed part.',
    },
    {
      id: 'copyright',
      title: 'Copyright claims',
      where: 'Studio → Content → open a video → Copyright',
      why: 'A claimed Short over 1 minute can be blocked; the YouTube API doesn’t show claims.',
      ifFound: 'Trim the Short under 60 seconds or replace the music with cleared audio.',
    },
    {
      id: 'strikes',
      title: 'Warnings and strikes',
      where: 'Studio → Dashboard and the notification bell',
      why: 'A strike freezes uploads and can limit the channel; the API doesn’t show strikes.',
      ifFound: 'Complete any policy training and fix the cause before uploading more.',
    },
    {
      id: 'feature_eligibility',
      title: 'Feature eligibility',
      where: 'Studio → Settings → Channel → Feature eligibility',
      why: 'Shows if your channel has lost access to features.',
      ifFound: 'Follow the steps YouTube lists there to restore access.',
    },
  ];
  if (hasShorts) {
    checks.push(
      {
        id: 'shown_in_feed',
        title: 'Shown in feed',
        where: 'Studio → Content → Shorts → open a Short → Analytics → Reach',
        why: 'How many times the Short was offered in the Shorts feed. The API doesn’t provide this.',
        ifFound: 'If it’s 0 on several Shorts, treat it as “not shown”: check the items above and originality.',
      },
      {
        id: 'viewed_vs_swiped',
        title: 'Viewed vs swiped away',
        where: 'Studio → Content → Shorts → open a Short → Analytics → Engagement',
        why: 'The share who stayed instead of swiping in the first second. The API doesn’t provide this.',
        ifFound: 'Compare with your own other Shorts; a low “viewed” share means the first second needs work.',
      }
    );
  }
  return checks;
}

// ─── Verdict ───────────────────────────────────────────────────────────────────

const HEADLINES: Partial<Record<ViewsCause, { headline: (n: number, of: number) => string; firstStep: string }>> = {
  blocked: {
    headline: (n) => `${plural(n, 'recent video is', 'recent videos are')} blocked, rejected or not public.`,
    firstStep: 'Fix the blocked videos listed below first; nothing else helps until they can play.',
  },
  not_shown: {
    headline: (n, of) => `YouTube isn’t showing your videos: ${n} of ${of} got no impressions or views.`,
    firstStep: 'Check the Studio items below (copyright, strikes, Feature eligibility), then post one clearly original video.',
  },
  not_in_feed: {
    headline: (n, of) => `Your Shorts aren’t reaching the Shorts feed (${n} of ${of}).`,
    firstStep: 'Check Copyright and Restrictions in Studio, and make each Short vertical, original and under 60 seconds if it uses music.',
  },
  not_clicked: {
    headline: (n, of) => `People see your videos but don’t click (${n} of ${of} under 2% CTR).`,
    firstStep: 'Rebuild titles and thumbnails around one clear promise, with the search phrase first.',
  },
  new_topic: {
    headline: (n, of) => `Shorts on a new topic didn’t find an audience (${n} of ${of}): YouTube likely tested them on new viewers.`,
    firstStep: 'Stay with the topic that works, or post several Shorts on a new topic in a row so YouTube can find its viewers.',
  },
  weak_hook: {
    headline: (n, of) => `Weak hooks: viewers swipe your Shorts away in the first seconds (${n} of ${of}).`,
    firstStep: 'Open with the payoff: show the result or the best moment in the first second.',
  },
  left_early: {
    headline: (n, of) => `Viewers start watching, then leave before the end (${n} of ${of}).`,
    firstStep: 'Cut what comes before the payoff and end right after it.',
  },
  quick_stop: {
    headline: (n, of) => `Your Shorts get a first burst, then stop (${n} of ${of}): they lose the test against other Shorts.`,
    firstStep: 'Test one change per Short on the first second, and give viewers a reason to like, comment or share.',
  },
};

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** A headline with the channel's own numbers, when the affected videos have them. */
function specificHeadline(cause: ViewsCause, affected: VideoFinding[], judged: number, timelines: Map<string, ShortTimeline>): string | null {
  const t = affected.map((f) => timelines.get(f.videoId)).filter((x): x is ShortTimeline => Boolean(x));
  const of = `${affected.length} of ${judged} videos`;
  if (cause === 'weak_hook') {
    const swipe = mean(t.map((x) => x.estSwipeAway).filter((v): v is number => v !== null));
    if (swipe !== null) return `Weak hooks: viewers swipe your Shorts away in the first seconds, about ${pct(swipe)} of plays on average (estimate), on ${of}.`;
  }
  if (cause === 'left_early') {
    const half = median(t.map((x) => x.halfGoneAtSec).filter((v): v is number => v !== null));
    if (half !== null) return `Viewers leave early: half of them are gone by ${clock(half)} (median), on ${of}.`;
  }
  if (cause === 'quick_stop') {
    const share = median(t.map((x) => x.firstDaysShare).filter((v): v is number => v !== null));
    if (share !== null) return `Your Shorts get ${pct(share)} of their views in the first ${R.quickStop.firstDays} days, then stop (${of}): they lose the test against other Shorts.`;
  }
  return null;
}

/** The first step, pointed at the worst affected video. */
function specificFirstStep(cause: ViewsCause, affected: VideoFinding[], timelines: Map<string, ShortTimeline>): string | null {
  if (cause !== 'new_topic' && cause !== 'weak_hook' && cause !== 'left_early' && cause !== 'quick_stop') return null;
  const worst = affected
    .map((f) => ({ f, t: timelines.get(f.videoId) }))
    .filter((x) => x.t)
    .sort((a, b) => (b.t!.estSwipeAway ?? 0) - (a.t!.estSwipeAway ?? 0))[0];
  return worst?.f.fix ? `Start with “${worst.f.title}”: ${worst.f.fix}` : null;
}

export function analyzeViews(data: ViewsCheckDataset): ViewsCheckReport {
  const status = data.status.ok ? data.status.data : {};
  const kidsVideos = data.videos.filter((v) => status[v.id]?.madeForKids).length;
  const kidsChannel = data.videos.length > 0 && kidsVideos / data.videos.length > 0.5;

  // Shorts are compared with the channel's own Shorts, so their timelines come first.
  const timelines = new Map<string, ShortTimeline>();
  for (const video of data.videos) {
    if (formatOf(video) === 'short' && reportedDays(video, data) >= R.minReportedDays && !judgeAvailability(status[video.id], kidsChannel)) {
      timelines.set(video.id, shortTimeline(video, data));
    }
  }
  const swipes = Array.from(timelines.values())
    .filter((t) => t.views > 0)
    .map((t) => t.estSwipeAway)
    .filter((v): v is number => v !== null);
  const medianSwipe = median(swipes);
  timelines.forEach((t) => (t.channelMedianSwipeAway = medianSwipe));

  const shortVideos = data.videos.filter((v) => formatOf(v) === 'short');
  const topicOf = topicIndex(data.topics);
  const topics = topicSummaries(data.topics, shortVideos, timelines, new Date(data.collectedAt));
  // Each Short's views on its upload day, for "your usual first day" (only Shorts whose data starts there).
  const firstDay = new Map<string, number>();
  for (const v of shortVideos) {
    const d = data.deepDives[v.id]?.daily;
    const pub = v.publishedAt.slice(0, 10);
    if (d?.ok && pub >= data.period.startDate) firstDay.set(v.id, d.data.find((r) => r.date === pub)?.views ?? 0);
  }
  const usualFirstDay = (id: string) => {
    const others = Array.from(firstDay.entries()).filter(([k]) => k !== id).map(([, v]) => v);
    return others.length >= R.opening.minShortsForMedian ? median(others) : null;
  };
  const usualViews = median(shortVideos.filter((v) => timelines.has(v.id) && v.lifetimeViews !== null).map((v) => v.lifetimeViews as number));
  const stops: ReturnType<typeof stopPointOf>[] = [];

  const shorts: ShortTimeline[] = [];
  const findings: VideoFinding[] = data.videos.map((video) => {
    const format = formatOf(video);
    const days = reportedDays(video, data);
    const stats = data.perVideo.ok ? data.perVideo.data[video.id] : undefined;
    const base = {
      videoId: video.id,
      title: video.title,
      format,
      publishedAt: video.publishedAt,
      reportedDays: days,
      lifetimeViews: video.lifetimeViews,
      durationSec: video.durationSec ?? null,
      avgViewPct: stats?.avgViewPct ? stats.avgViewPct : null,
    };
    const blocked = judgeAvailability(status[video.id], kidsChannel);
    if (blocked) return { ...base, ...blocked };
    if (days < R.minReportedDays) {
      return {
        ...base,
        cause: 'too_new',
        reason: 'Too new to judge: YouTube Analytics is about 3 days behind.',
        evidence: [`${plural(days, 'reported day')}`],
        fix: 'Check again in a few days.',
      };
    }
    if (format === 'short') {
      const timeline = timelines.get(video.id) ?? shortTimeline(video, data);
      // Every Short: swipe-away and % viewed come from bulk calls; the in-depth numbers (per day,
      // traffic, retention) are filled when the Short was looked at in depth.
      shorts.push(timeline);
      let judgement = judgeShort(timeline, days, swipes.length);
      // A likely topic switch explains a weak hook or an early stop better than the hook itself.
      if (judgement.cause === 'weak_hook' || judgement.cause === 'left_early' || judgement.cause === 'quick_stop' || judgement.cause === 'ok') {
        judgement = newTopicJudgement(video, shortVideos, topicOf, usualViews, topics, shortEvidence(timeline)) ?? judgement;
        if (judgement.cause === 'new_topic') judgement.fix = `${judgement.fix} ${shortFix(timeline)}`.trim();
      }
      timeline.topic = topicOf.get(video.id) ?? null;
      timeline.gates = gatesFor(timeline, judgement.cause, isHighSwipe(timeline, swipes.length));
      stops.push(stopPointOf(timeline.gates));
      timeline.test = shortTest(timeline, Array.from(timelines.values()), usualViews);
      const daily = data.deepDives[video.id]?.daily;
      // Rounds count from the publish day, so the data must start there.
      timeline.rounds = daily?.ok && video.publishedAt.slice(0, 10) >= data.period.startDate ? testRounds(daily.data, video.publishedAt, days, timeline.test, usualFirstDay(video.id)) : null;
      return { ...base, ...judgement };
    }
    return { ...base, ...judgeLong(video, data, days) };
  });

  const recent = findings.slice(0, R.recentVideos);
  const judged = recent.filter((f) => f.cause !== 'too_new' && f.cause !== 'unknown');
  const byCause: Partial<Record<ViewsCause, number>> = {};
  for (const f of findings) byCause[f.cause] = (byCause[f.cause] ?? 0) + 1;

  const signals = channelSignals(data, recent);
  const blockedRecent = recent.filter((f) => f.cause === 'blocked');
  let verdict: ViewsCheckReport['verdict'];
  if (blockedRecent.length) {
    const h = HEADLINES.blocked!;
    verdict = { cause: 'blocked', headline: h.headline(blockedRecent.length, recent.length), firstStep: h.firstStep, basedOn: recent.length };
  } else if (signals[0]?.id === 'channel_wide_stop') {
    verdict = { cause: 'channel_wide_stop', headline: `${signals[0].title}. ${signals[0].detail}`, firstStep: signals[0].fix, basedOn: judged.length };
  } else if (judged.length === 0) {
    verdict = {
      cause: 'not_enough_data',
      headline: 'Not enough data yet to judge your recent videos.',
      firstStep: 'Keep posting and run the check again once your newest uploads are at least 3 days old.',
      basedOn: 0,
    };
  } else {
    const problems = SEVERITY.filter((c) => HEADLINES[c] && c !== 'blocked')
      .map((c) => ({ cause: c, n: judged.filter((f) => f.cause === c).length }))
      .filter((p) => p.n > 0)
      .sort((a, b) => b.n - a.n || SEVERITY.indexOf(a.cause) - SEVERITY.indexOf(b.cause));
    const top = problems[0];
    if (top) {
      const h = HEADLINES[top.cause]!;
      const affected = judged.filter((f) => f.cause === top.cause);
      verdict = {
        cause: top.cause,
        headline: specificHeadline(top.cause, affected, judged.length, timelines) ?? h.headline(top.n, judged.length),
        firstStep: specificFirstStep(top.cause, affected, timelines) ?? h.firstStep,
        basedOn: judged.length,
      };
    } else {
      verdict = {
        cause: 'ok',
        headline: `No distribution problem found in your last ${plural(judged.length, 'judged video')}.`,
        firstStep: 'Keep the format that works and test one new idea at a time.',
        basedOn: judged.length,
      };
    }
  }

  const plan: string[] = [];
  const add = (step: string) => step && !plan.includes(step) && plan.length < R.maxPlanSteps && plan.push(step);
  add(verdict.firstStep);
  for (const f of [...recent].sort((a, b) => SEVERITY.indexOf(a.cause) - SEVERITY.indexOf(b.cause))) {
    // Fixes built from one video's numbers name that video, so the step is clear on its own.
    const perVideo = timelines.has(f.videoId) && (f.cause === 'new_topic' || f.cause === 'weak_hook' || f.cause === 'left_early' || f.cause === 'quick_stop');
    if (f.fix && !verdict.firstStep.includes(f.fix)) add(perVideo ? `“${f.title}”: ${f.fix}` : f.fix);
  }
  for (const s of signals.filter((s) => s.severity !== 'low')) add(s.fix);
  for (const s of signals.filter((s) => s.severity === 'low')) add(s.fix);

  const limitations: string[] = [];
  for (const [, result] of [
    ['availability', data.status],
    ['performance', data.perVideo],
    ['engaged views', data.engaged],
  ] as const) {
    if (!result.ok) limitations.push(result.reason);
  }
  limitations.push(
    'YouTube Analytics reports views per day, not per hour, and is about 3 days behind; videos newer than that aren’t judged.',
    '“Shown in feed”, “Viewed vs swiped away”, copyright claims and strikes aren’t available through the YouTube API; check them in Studio (listed above).'
  );

  const viewsOf = (format: 'short' | 'video') => {
    const values = data.videos.filter((v) => formatOf(v) === format).map((v) => v.lifetimeViews).filter((n): n is number => n !== null);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  };

  return {
    verdict,
    videos: findings,
    shorts,
    signals,
    studioChecks: studioChecks(data.videos.some((v) => formatOf(v) === 'short')),
    plan,
    limitations,
    summary: {
      judgedVideos: judged.length,
      tooNew: findings.filter((f) => f.cause === 'too_new').length,
      byCause,
      avgShortViews: viewsOf('short'),
      avgLongViews: viewsOf('video'),
    },
    topics,
    testAgreement: testAgreement(shorts.filter((t) => t.test).map((t) => ({ views: t.views, score: (t.test as ShortTest).score }))),
    stopPoints: (['shown', 'stopped', 'stayed', 'reacted', 'none', 'unknown'] as const).map((gate) => ({ gate, count: stops.filter((s) => s === gate).length })),
    stage: channelStage(
      data.videos.filter((v) => formatOf(v) === 'short'),
      shorts,
      { subscriberCount: data.channel.subscriberCount, createdAt: data.channelCreatedAt ?? null },
      new Date(data.collectedAt)
    ),
  };
}
