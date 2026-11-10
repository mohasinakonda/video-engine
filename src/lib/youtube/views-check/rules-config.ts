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
    /** Long videos without a retention curve (few views): average % viewed below this counts as leaving early. */
    longWeakAvgViewPct: 30,
    /** Shorts: estimated swipe-away at or above this is a weak first second… */
    highSwipeAway: 0.6,
    /** …or this much above the channel's own median (with at least minShortsForMedian Shorts). */
    swipeAboveMedian: 0.15,
    minShortsForMedian: 3,
    /** Half the viewers gone within this many seconds = they decide on the opening. */
    instantExitSec: 3,
    /** Retention points ignored at the start when looking for the biggest drop (the swipe itself). */
    ignoreStartRatio: 0.05,
    /** Leaving that starts after this many seconds isn't the hook's first seconds: the fix points at the moment. */
    hookSec: 2,
    /** The curve must start at this share of views or more to read an exit window (lower = they left at once). */
    openingHeldShare: 0.8,
    /** The exit window starts when the opening audience has dropped to this share. */
    exitStartShare: 0.9,
    /** "Watched to the end" is read here, not at the very last point, which is noisy (people swipe in the final second). */
    completionAtRatio: 0.95,
  },
  topics: {
    /** A Short is on a new topic when none of this many Shorts before it shared its topic… */
    previousShorts: 5,
    /** …counting only when there were at least this many before it. */
    minPrevious: 3,
  },
  reactions: {
    /** Likes + comments + shares per 100 views below this: viewers didn't react. A Rendoza line, not a YouTube one. */
    minPer100Views: 1,
  },
  test: {
    /** How much each viewer signal counts in the test score. */
    weights: { stayed: 0.5, watched: 0.3, reacted: 0.2 },
    /** Healthy floors: the benchmark is the channel's usual, never below these. Rendoza lines, not YouTube's. */
    floor: { stayed: 0.4, watched: 0.5, reacted: 1 },
    /** A ratio counts at most this much, so one great number can't hide a bad one. */
    cap: 1.5,
    /** Other Shorts needed before "your usual" is used instead of the floor. */
    minOthers: 3,
    /** Score at or above: passed; at or above `close`: almost. */
    pass: 100,
    close: 80,
    /** Agreement check: only pairs whose views differ by this factor, and only with this many pairs. */
    pairViewsRatio: 1.5,
    minPairs: 3,
  },
  rounds: {
    /**
     * Round n = day n since upload; this many rounds. Round 1 passes with at least the channel's
     * usual first-day views; a later round passes only with more views than the day before.
     */
    count: 3,
    /** Fewer views than this on a day: its rates are too noisy to compare. */
    minViews: 30,
    /** A rate counts as dropped when it falls to this share of the day before (or of the usual Short). */
    drop: 0.85,
  },
  stage: {
    /** Shorts at least this old are compared: most of a Short's views arrive in its first days. */
    minAgeDays: 2,
    /** Each window holds up to this many Shorts (the newest vs the ones before). */
    window: 5,
    /** Fewer Shorts per window than this: not enough to see a trend. */
    minWindow: 3,
    /** Floor and median both up this much: YouTube is finding an audience. */
    risingFloor: 1.5,
    risingMedian: 1.2,
    /** Median down to this share of before: slowing. */
    slowingMedian: 0.6,
    /** Highest ÷ lowest in the newest window at or above this: still testing each Short. */
    testingSwing: 8,
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
