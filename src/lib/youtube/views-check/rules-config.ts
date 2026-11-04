/**
 * Thresholds for the views check. Kept in one place so they can be tuned and tested; every
 * finding states the numbers it saw.
 */
export const VIEWS_RULES = {
  /** Reported analytics days a video needs before it is judged (YouTube Analytics lags 2–3 days). */
  minReportedDays: 3,
  /** Uploads looked at for channel-wide patterns. */
  recentVideos: 10,
  /** A Short is anything this short when YouTube hasn't told us the format yet. */
  shortMaxSec: 180,

  notShown: {
    /** Long video with fewer impressions than this after minReportedDays = not distributed. */
    maxImpressions: 0,
    /** Short with at least this many views, of which this share or less came from the Shorts feed. */
    minViewsForFeedCheck: 10,
    maxShortsFeedShare: 0.05,
  },
  packaging: {
    /** Half of channels and videos sit between 2% and 10% impressions CTR (YouTube Help). */
    lowCtr: 0.02,
    /** Impressions needed before CTR means anything. */
    minImpressions: 100,
  },
  opening: {
    /** Long videos: share still watching 30 s in. */
    earlyExitSec: 30,
    earlyExitWatchRatio: 0.6,
    /** relativeRetentionPerformance: 0.5 is typical for similar-length videos; below this is weak. */
    weakRelative: 0.35,
    /** Shorts: average % viewed below this is weak. */
    shortsWeakAvgViewPct: 50,
    /** Shorts: estimated swipe-away at or above this is a weak first second… */
    highSwipeAway: 0.6,
    /** …or this much above the channel's own median (with at least minShortsForMedian Shorts). */
    swipeAboveMedian: 0.15,
    minShortsForMedian: 3,
    /** Half the viewers gone within this many seconds = they decide on the opening. */
    instantExitSec: 3,
    /** Retention points ignored at the start when looking for the biggest drop (the swipe itself). */
    ignoreStartRatio: 0.05,
  },
  quickStop: {
    /** Shorts with most of their views in the first days. */
    firstDays: 2,
    firstDaysShare: 0.8,
    minReportedDays: 5,
    minViews: 50,
  },
  channel: {
    /** Share of judged recent uploads that must be "not shown" for a channel-wide stop. */
    wideStopShare: 0.6,
    wideStopMinVideos: 3,
    /** Title similarity for "same topic posted as a Short and a long video". */
    doublePostSimilarity: 0.6,
    /** Long videos all at or below this length. */
    shortLongFormSec: 240,
    longGapDays: 30,
    /** Uploads per day (over the last 14 days) that, with similar titles, look mass-produced. */
    highVolumePerDay: 3,
    highVolumeSimilarShare: 0.4,
    /** Median views of the last 5 vs the 5 before, at or below this ratio. */
    suddenDropRatio: 0.3,
    suddenDropMinAgeDays: 7,
    /** Subscribers per view below this is weak conversion. */
    lowSubscribeRate: 0.001,
    minViewsForSubscribeRate: 1000,
    /** Average Short views this many times the average long-video views. */
    formatGapRatio: 10,
  },
  maxPlanSteps: 5,
} as const;
