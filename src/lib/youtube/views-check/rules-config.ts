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
    /** Shorts: estimated swipe-away at or above this is a weak first second (45%+ = poor on creators' benchmarks)… */
    highSwipeAway: 0.45,
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
    /**
     * Trust Score (YRDS): each metric ÷ the median of the channel's other Shorts = R; its score
     * S = min(100, 50 × R), so 50 = as good as the usual Short and 100 = twice as good or better.
     * Trust Score = the weighted sum of S.
     */
    weights: {
      viewed: 0.35,
      watched: 0.3,
      shares: 0.15,
      likes: 0.1,
      subscribed: 0.1,
    },
    /** S = min(max, scale × R). */
    scale: 50,
    max: 100,
    /** Other Shorts needed for a median; a metric with fewer is left out (weights shared among the rest). */
    minOthers: 3,
    /** Score at or above `pass`: above the usual Short; at or above `close`: near it. */
    pass: 50,
    close: 40,
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
    /** This many uploads within `burstMinutes`: a spam signal. */
    burstUploads: 3,
    burstMinutes: 60,
    /** Same length (± seconds) and near-identical title: the same file uploaded again. */
    reuploadLengthSec: 1,
    reuploadSimilarity: 0.8,
    /** First upload within this many days of creating the channel: no warm-up. */
    warmupDays: 7,
  },
  region: {
    /** A block in any of the channel's top viewer countries is the most likely reason for 0 views. */
    topCountries: 3,
    /** Blocked in this many countries or more: treated as blocked almost everywhere. */
    nearlyEverywhere: 200,
  },
  maxPlanSteps: 5,
  health: {
    /**
     * Shorts health score (CHS) = 0.70 × P + 0.30 × T. P = median over the newest Shorts of each
     * Short's score against fixed healthy lines (same 5 metrics and weights as the Trust Score,
     * S = min(100, 70 × value ÷ line)). T = 70 + (median Trust Score of the newest Shorts − the ones
     * before), 0–100. Rendoza lines, not YouTube's.
     */
    weights: { p: 0.7, t: 0.3 },
    /**
     * The score at the healthy line and for a flat trend: the bottom of "Healthy", so a channel at
     * every line with no change scores 70. A part's score is min(100, 70 × value ÷ line); T = 70 + change.
     */
    atLine: 70,
    lines: { viewed: 0.55, shares: 0.005, likes: 0.03, subscribed: 0.002 },
    /** Average % viewed line by length: shorter Shorts are expected to be watched further (and loop). */
    watchedByLength: [
      { upToSec: 20, line: 0.8 },
      { upToSec: 40, line: 0.7 },
      { upToSec: 60, line: 0.6 },
      { upToSec: Infinity, line: 0.5 },
    ],
    /** Newest Shorts used, and the fewest views a Short needs for its rates to count. */
    maxShorts: 30,
    minViews: 20,
    /** Fewer scored Shorts than this: provisional. */
    confidentShorts: 20,
    /** Trend: up to this many newest vs the ones before, at least `minTrend` in each. */
    trendWindow: 10,
    minTrend: 3,
    minShorts: 3,
    /** Bands (lower bounds). */
    bands: { excellent: 85, healthy: 70, average: 55, weak: 40 },
  },
  distribution: {
    /**
     * Distribution score: is YouTube showing the channel's Shorts? Each part scores
     * min(100, 70 × value ÷ line) like the health score; missing parts are left out.
     * shown: share of judged Shorts that got into the feed; momentum: newest ÷ before (the growth
     * outlook's reach); feed: median share of views from the Shorts feed.
     */
    weights: { shown: 0.4, momentum: 0.35, feed: 0.25 },
    lines: { shown: 0.9, momentum: 1, feed: 0.7 },
    maxShorts: 30,
    minShorts: 3,
    minFeedShorts: 3,
    confidentShorts: 10,
  },
  account: {
    /**
     * Account health: 100 minus points per problem found. Per-video problems lose `perVideo` points
     * each, up to `caps`; channel problems lose `signals` points once. Rendoza's reading of what the
     * API shows; strikes and claims without a block aren't visible.
     */
    perVideo: {
      rejected: 15,
      copyright_block: 15,
      main_country_block: 8,
      country_block: 2,
      age_restricted: 5,
      made_for_kids: 5,
    },
    caps: {
      rejected: 30,
      copyright_block: 45,
      main_country_block: 24,
      country_block: 6,
      age_restricted: 15,
      made_for_kids: 10,
    },
    signals: {
      standing_risk: 40,
      re_upload: 15,
      mass_produced_risk: 15,
      not_verified: 10,
      upload_burst: 8,
      unclear_titles: 5,
      no_warmup: 3,
      double_post: 3,
      hashtags_in_titles: 2,
    },
  },
  outlook: {
    /** Shorts at least this old count: most of a Short's views arrive in its first days. */
    minAgeDays: 2,
    /** Newest Shorts vs the ones before, up to this many in each window. */
    window: 5,
    /** Fewer Shorts per window than this: too early to tell. */
    minWindow: 3,
    /** Recent ÷ before at or above this: reach is rising; at or below `falling`: falling. */
    rising: 1.15,
    falling: 0.85,
    /** Median swipe-away of the newest Shorts at or below this: viewers like them (45%+ = poor). */
    goodSwipeAway: 0.45,
    /** A Short needs this many views before its swipe-away counts. */
    minViewsForSwipe: 30,
    /** The look-back check: what the outlook said this many days ago, and what happened since. */
    checkDays: 30,
  },
} as const;
