/** Every threshold the Viral Engine rules use, in one place so they can be tuned without touching the rules. */
export const RULES = {
  /** Longest video accepted (YouTube Shorts go up to 3 minutes). */
  maxDurationSec: 180,

  // Picture
  /** Motion is the share of pixels that changed since the last sample (every 0.25 s). */
  /** More than 2% of the picture changing counts as "something changes" (a small animated area is enough). */
  movingMotion: 0.02,
  /** Most of the picture changing at once is a cut. */
  cutMotion: 0.45,
  /** Cuts closer than this are merged. */
  cutMinGapSec: 0.5,
  /** A fade or dissolve: this much change spread over `fadeWindowSec`, with calmer picture either side. */
  fadeMotion: 0.8,
  fadeWindowSec: 1,
  /** First and last frame with at most 8% of pixels different make a loop (a shared dark background alone isn't enough). */
  loopMin: 0.92,

  // Sound
  /** dBFS below this is near-silence (no voice, music or ambient sound). */
  silenceDb: -45,
  /** Average loudness of the audible parts below this is too quiet. */
  quietDb: -32,
  /** Share of clipped samples (percent) above this is distorted. */
  clippingPct: 1,

  // Hook
  /** Something must change, or speech or text must start, by this second. */
  hookSec: 1,
  /** A strong hook shows motion or text by this second... */
  strongHookMotionSec: 0.5,
  /** ...and speech or on-screen text by this second. */
  strongHookSpeechSec: 0.8,
  /** Speech starting later than this, over a silent opening, is a quiet open. */
  quietOpenSec: 1.5,
  /** Length of the hook region on the timeline. */
  hookRegionSec: 2,

  /** A finding covering at least this share of the video is listed as "most of the video", not drawn as a block. */
  mostOfVideoShare: 0.6,

  // Stretches
  /** Nothing to see or hear for this long is a dead zone. */
  deadZoneMinSec: 2.5,
  /** No talking for this long is a quiet stretch. */
  quietStretchMinSec: 3,
  /** One still shot longer than this (talking formats: `staticShotTalkingSec`). */
  staticShotSec: 4,
  staticShotTalkingSec: 6,

  // Payoff
  /** The payoff is searched only after this share of the video (an early result is a teaser). */
  payoffMinShare: 0.4,
  /** After the payoff, more than max(this, `tailMaxShare` × duration) is a long tail. */
  tailMinSec: 3,
  tailMaxShare: 0.1,

  // Captions
  /** Talking for more than this share of the video without captions. */
  captionsSpeechShare: 0.5,
  /** Captions seen in fewer than this share of talking frames counts as none. */
  captionsSeenShare: 0.2,

  // Vision flags that can hurt the channel need at least this many frames.
  minFramesForFlag: 2,

  // Retention
  /** A fall of more than this many points per second is a steep drop... */
  steepDropPerSec: 3,
  /** ...and, with a baseline, also this many points per second worse than the usual Short. */
  steepVsUsualPerSec: 1.5,
  /** Steep falls in the first seconds are normal for Shorts (swipes); judged only against the baseline. */
  dropIgnoreBeforeSec: 1.5,
  /** At most this many points per second counts as "viewers stayed". */
  flatDropPerSec: 1.5,
  /** Fewer Shorts than this, no baseline. */
  minBaselineShorts: 3,

  // Channel fit (embedding similarity of this Short’s topic to the channel’s video titles).
  // Calibrated on bge-m3 with a cooking channel: on-topic gaps −0.12…+0.01 (cross-language),
  // off-topic +0.07 (gym) … +0.15 (gadgets).
  /** At least this many recent uploads to judge the topic. */
  minFitVideos: 5,
  /** This far below the channel's own typical similarity is off-topic (yellow)... */
  offTopicMargin: 0.05,
  /** ...and this far below is clearly off-topic (red). */
  farOffTopicMargin: 0.1,
  /** Within this of the typical similarity counts as on-topic (green). */
  onTopicMargin: 0.02,
  /** Longer than this × the channel's better Shorts (and by `longerMinExtraSec`) is long for this channel. */
  longerThanUsual: 1.5,
  longerMinExtraSec: 10,
  /** At least this many recent Shorts with views to compare length. */
  minShortsForLength: 5,
} as const;
