/**
 * Thresholds for the deterministic diagnosis. Kept in one place so they can be tuned and
 * tested; every rule that uses them states the numbers it saw in its evidence.
 */
export const RULES = {
  /** Videos needed before a median is used as a baseline. */
  minBaselineVideos: 4,
  /** Videos with views in the period needed for a channel-level diagnosis. */
  minVideosForDiagnosis: 5,
  outperformerRatio: 2,
  underperformerRatio: 0.5,
  /** How many of the newest uploads count as "recent" for pattern rules. */
  recentVideos: 10,

  packaging: {
    ctrRatio: 0.7,          // CTR at or below 70% of the channel median
    minImpressions: 1000,   // per video, so CTR is meaningful
    minVideos: 3,
  },
  retention: {
    avpRatio: 0.8,          // average % viewed at or below 80% of the median
    minVideos: 3,
    earlyExitSec: 30,
    earlyExitWatchRatio: 0.6, // fewer than 60% still watching at 30 s
    steepDropMinPoints: 3,  // percentage points between neighbouring points
    steepDropMultiplier: 2.5, // × the curve's median drop
    ignoreIntroRatio: 0.03,
    rewatchSpikePoints: 2,
    weakRelative: 0.35,     // relativeRetentionPerformance below this…
    weakStretchPoints: 10,  // …across this many consecutive points (10% of the video)
    minViewsForHighConfidence: 500,
    /** Below this many period views a curve is too noisy for drop/spike detection. */
    minViewsForShape: 300,
    /** Report at most this many drops or spikes per video (the largest). */
    maxPerKind: 3,
  },
  topic: {
    minUnderperformers: 3,
    normalAvpRatio: 0.9,
  },
  acquisition: {
    lowDiscoveryShare: 0.3,
    strongDiscoveryShare: 0.6,
  },
  consistency: {
    maxDaysWithoutUpload: 30,
    gapVariation: 1, // coefficient of variation of upload gaps
    gapSample: 8,
    /** An irregular schedule also needs at least one long gap. */
    minLongGapDays: 14,
    /** Views falling at least this much while uploads paused links the two. */
    declinePct: -30,
    pauseDays: 14,
  },
  growthStrengthPct: 20,
} as const;

/** Traffic sources YouTube's recommendation system drives (Browse, Suggested, Shorts feed). */
export const DISCOVERY_SOURCES = new Set(['SUBSCRIBER', 'RELATED_VIDEO', 'SHORTS']);

/** Readable names for insightTrafficSourceType values. */
export const TRAFFIC_LABELS: Record<string, string> = {
  SUBSCRIBER: 'Home page and subscriptions',
  RELATED_VIDEO: 'Suggested videos',
  SHORTS: 'Shorts feed',
  YT_SEARCH: 'YouTube search',
  EXT_URL: 'External',
  NO_LINK_OTHER: 'Direct or unknown',
  YT_CHANNEL: 'Channel pages',
  PLAYLIST: 'Playlists',
  YT_PLAYLIST_PAGE: 'Playlist page',
  NOTIFICATION: 'Notifications',
  END_SCREEN: 'End screens',
  YT_OTHER_PAGE: 'Other YouTube features',
  HASHTAGS: 'Hashtag pages',
  ADVERTISING: 'Ads',
  NO_LINK_EMBEDDED: 'Embedded players',
  SHORTS_CONTENT_LINKS: 'Shorts related video links',
  VIDEO_REMIXES: 'Remixes',
  SOUND_PAGE: 'Sound pages',
  CAMPAIGN_CARD: 'Campaign cards',
  ANNOTATION: 'Cards and annotations',
  LIVE_REDIRECT: 'Live redirects',
  PRODUCT_PAGE: 'Product pages',
};

/** Thresholds for Discover (docs/discover-plan.md). Tuned on real channels; every user-facing claim states its numbers. */
export const DISCOVER_RULES = {
  /**
   * Cosine at or above which two titles count as the same topic, per embedding model.
   * bge-m3, measured 19 Oct 2026 against a wildlife channel: unrelated channels (cooking,
   * MrBeast, Kurzgesagt) score 0.38–0.50, a related one (BBC Earth) 0.53–0.63.
   */
  titleMatch: { 'BAAI/bge-m3': 0.57, default: 0.6 } as Record<string, number>,
  /** Models that pair English and Bangla titles well; others cap confidence at medium. */
  strongEmbeddingModels: ['BAAI/bge-m3'],
  discovery: {
    /** Search looks back this far, so found channels are active now. */
    searchWindowDays: 90,
    /** Channels kept from search results before fetching their uploads. */
    maxCandidates: 30,
    /** Suggestions shown to the user. */
    maxSuggestions: 20,
    /** Recent uploads read per candidate. */
    titlesPerCandidate: 15,
    /** Your uploads used to describe your topics. */
    yourTitles: 50,
    minYourTitles: 3,
    /** Videos up to this long count as likely Shorts (the public API has no Shorts flag). */
    shortsMaxSec: 180,
    /** Share of a candidate's titles matching yours. */
    directOverlap: 0.4,
    adjacentOverlap: 0.15,
    /** Shorts shares closer than this count as a similar format mix. */
    formatMixTolerance: 0.3,
    relevanceHigh: 0.6,
    relevanceMedium: 0.3,
  },
  outliers: {
    /** Younger videos are still collecting views: not compared yet. */
    minAgeDays: 7,
    /** Older videos are left out of the baseline (a channel changes over a year). */
    maxBaselineAgeDays: 365,
    /** Same-format videos needed for a usable baseline, and for a strong one. */
    minBaseline: 6,
    highBaseline: 12,
    /** Both must hold: views ≥ 2× the channel's usual, and a robust z-score ≥ 2 on log views. */
    minRatio: 2,
    minRobustZ: 2,
    /** Outliers kept in the result (strongest first). */
    maxReported: 40,
  },
} as const;
