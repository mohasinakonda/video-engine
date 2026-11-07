/**
 * The Viral Engine rules: measured signals + the vision model's frame descriptions + (optional)
 * real retention → red / yellow / green findings on a timeline. Pure: no I/O, so it is unit-tested
 * and re-run in the browser when the user corrects the format.
 *
 * The model only describes frames; every judgement is made here. Real retention is applied last
 * and wins over the rules' estimate.
 */
import { RULES } from './rules-config';
import { fallPerSec, findDrops, pctAt, type Drop } from './retention';
import { findRuns, formatRange, formatTime, round, sampleAt } from './signals';
import {
  SILENT_OK_FORMATS,
  type EngineInput,
  type FrameFinding,
  type IssueEvidence,
  type IssueKind,
  type Level,
  type MetadataCheck,
  type RetentionPoint,
  type ShortFormat,
  type TimelineIssue,
  type ViralReport,
} from './types';

const M = (source: IssueEvidence['source']): IssueEvidence => ({ source, measured: true });
const EST: IssueEvidence = { source: 'vision', measured: false };

const TALKING_FORMATS: ShortFormat[] = ['talking', 'tutorial', 'skit'];
/** Findings that depend on timing, so real retention can confirm or overrule them. */
const RETENTION_CHECKED: IssueKind[] = ['dead_zone', 'quiet_stretch', 'static_shot', 'long_tail'];

type Draft = Omit<TimelineIssue, 'id'>;

export function analyzeShort(input: EngineInput): ViralReport {
  const { signals, vision, channel, metadata } = input;
  const dur = signals.durationSec;
  const format: ShortFormat = input.formatOverride ?? vision.format ?? 'other';
  const formatSource = input.formatOverride ? 'user' : vision.format ? 'vision' : 'default';
  const frames = [...vision.frames].sort((a, b) => a.t - b.t);

  const speaking = (t: number) => signals.speech.some((r) => t >= r.start && t < r.end);
  const audible = (t: number) => (sampleAt(signals.loudness, signals.loudnessStep, t) ?? -90) > RULES.silenceDb;
  const moving = (t: number) => (sampleAt(signals.motion, signals.motionStep, t) ?? 0) > RULES.movingMotion;
  const framesIn = (start: number, end: number) => frames.filter((f) => f.t >= start && f.t <= end);

  const drafts: Draft[] = [];
  const candidates: Draft[] = []; // quiet stretches that only retention can judge

  // ── Opening ────────────────────────────────────────────────────────────────
  const hookEnd = round(Math.min(RULES.hookRegionSec, dur), 2);
  const firstMotionIdx = signals.motion.findIndex((m, i) => i > 0 && m > RULES.movingMotion);
  const firstMotion = firstMotionIdx > 0 ? round(firstMotionIdx * signals.motionStep, 2) : null;
  const speechStart = signals.speech[0]?.start ?? null;
  const textFirst = frames.some((f) => f.t <= 0.5 && f.text);
  const silentOk = SILENT_OK_FORMATS.includes(format);
  const earlyMotion = firstMotion !== null && firstMotion <= RULES.strongHookMotionSec;
  const earlySpeech = speechStart !== null && speechStart <= RULES.strongHookSpeechSec;
  const openingAudible = findRuns(Math.min(1, dur), 0.1, audible, 0.5).length > 0;

  if ((earlyMotion || textFirst) && (earlySpeech || textFirst || (silentOk && openingAudible))) {
    drafts.push({
      kind: 'strong_hook',
      level: 'good',
      startSec: 0,
      endSec: hookEnd,
      title: 'Strong opening',
      saw: sentence([
        earlyMotion ? `The picture is already moving at ${firstMotion}s` : 'Text is on screen from the first frame',
        earlySpeech ? `speech starts at ${speechStart}s` : null,
        textFirst && earlyMotion ? 'there is text on screen from the first frame' : null,
      ]),
      fix: 'It starts on action instead of an intro, which is what stops the swipe. Keep opening this way.',
      evidence: [M('motion'), ...(earlySpeech ? [M('speech')] : []), ...(textFirst ? [EST] : [])],
    });
  } else if ((firstMotion === null || firstMotion > RULES.hookSec) && (speechStart === null || speechStart > RULES.hookSec) && !textFirst) {
    drafts.push({
      kind: 'slow_hook',
      level: 'bad',
      startSec: 0,
      endSec: hookEnd,
      title: 'Slow opening',
      saw: sentence([
        firstMotion === null ? 'The picture barely changes in the opening' : `Nothing changes on screen until ${firstMotion}s`,
        speechStart === null ? 'nobody speaks' : `nobody speaks until ${speechStart}s`,
        'and there is no text in the first frame',
      ]),
      fix: 'Start on the most interesting moment: cut any intro, logo or greeting and open with movement, a question or the result.',
      evidence: [M('motion'), M('speech'), EST],
    });
  } else if (!silentOk && (speechStart === null || speechStart > RULES.quietOpenSec) && !openingAudible) {
    drafts.push({
      kind: 'quiet_open',
      level: 'warn',
      startSec: 0,
      endSec: hookEnd,
      title: 'Silent first second',
      saw: speechStart === null ? 'The first second is almost silent and nobody speaks.' : `The first second is almost silent and speech only starts at ${speechStart}s.`,
      fix: 'Start talking, or add sound, in the first second. That is when people decide to swipe.',
      evidence: [M('speech'), M('sound')],
    });
  }

  // ── Stretches where nothing holds attention ────────────────────────────────
  const dead = findRuns(
    dur,
    signals.motionStep,
    (t) => !speaking(t) && !audible(t) && !moving(t),
    RULES.deadZoneMinSec
  ).filter((r) => !framesIn(r.start, r.end).some((f) => f.action));
  for (const r of dead) {
    drafts.push({
      kind: 'dead_zone',
      level: 'bad',
      startSec: r.start,
      endSec: r.end,
      title: 'Dead zone: nothing happens',
      saw: `For ${round(r.end - r.start)}s (${formatRange(r.start, r.end)}) nobody talks, the sound is near silent and the picture barely changes.`,
      fix: 'Cut it to under a second, speed it up, or cover it with sound, music or on-screen text.',
      evidence: [M('speech'), M('sound'), M('motion')],
    });
  }

  const quiet = findRuns(dur, signals.motionStep, (t) => !speaking(t) && (audible(t) || moving(t)), RULES.quietStretchMinSec);
  for (const r of quiet) {
    const hasSound = findRuns(r.end - r.start, signals.loudnessStep, (t) => audible(r.start + t), 0.5).length > 0;
    const hasMotion = findRuns(r.end - r.start, signals.motionStep, (t) => moving(r.start + t), 0.5).length > 0;
    const draft: Draft = {
      kind: 'quiet_stretch',
      level: 'warn',
      startSec: r.start,
      endSec: r.end,
      title: 'Long pause in the talking',
      saw: `Nobody talks for ${round(r.end - r.start)}s (${formatRange(r.start, r.end)}). There is ${hasSound ? 'sound' : 'almost no sound'} and ${
        hasMotion ? 'movement' : 'little movement'
      }.`,
      fix: 'In a talking Short, a pause this long loses viewers. Cut the pause or cover it with text or extra footage.',
      evidence: [M('speech'), M('sound'), M('motion')],
    };
    if (TALKING_FORMATS.includes(format)) drafts.push(draft);
    else candidates.push(draft);
  }

  // ── The picture doesn't change at all for too long ─────────────────────────
  // Any visible change counts (a cut, movement, an animated area, new text), so a slideshow or a
  // map that animates every second is not "still"; only a truly frozen picture is.
  const stillLimit = TALKING_FORMATS.includes(format) ? RULES.staticShotTalkingSec : RULES.staticShotSec;
  const still = findRuns(dur, signals.motionStep, (t) => !moving(t), stillLimit);
  for (const r of still) {
    if (dead.some((d) => overlap(d, r) > (r.end - r.start) / 2)) continue;
    drafts.push({
      kind: 'static_shot',
      level: 'warn',
      startSec: r.start,
      endSec: r.end,
      title: 'Picture frozen for too long',
      saw: `Nothing on screen changes for ${round(r.end - r.start)}s (${formatRange(r.start, r.end)}).`,
      fix: 'Change the angle, zoom in, or add a cut, movement or on-screen text every 2–3 seconds.',
      evidence: [M('motion')],
    });
  }

  // ── What the frames show (estimated) ───────────────────────────────────────
  for (const r of frameRanges(frames, (f) => Boolean(f.text) && (f.textPosition === 'bottom' || f.textSide === 'right'), dur)) {
    drafts.push({
      kind: 'safe_zone',
      level: 'warn',
      startSec: r.start,
      endSec: r.end,
      title: 'Text under the Shorts buttons',
      saw: 'On-screen text sits at the bottom or right edge of the frame, where YouTube shows the title, channel name and buttons.',
      fix: 'Move text and captions into the middle third of the frame, away from the bottom and the right edge.',
      evidence: [EST],
    });
  }

  for (const r of frameRanges(frames, (f) => Boolean(f.text) && f.textSize === 'small', dur)) {
    drafts.push({
      kind: 'small_text',
      level: 'warn',
      startSec: r.start,
      endSec: r.end,
      title: 'Text too small for a phone',
      saw: 'The on-screen text here looks too small to read on a phone.',
      fix: 'Use fewer, bigger words: about 5–7 words a line, readable at arm’s length.',
      evidence: [EST],
    });
  }

  const speechSec = signals.speech.reduce((s, r) => s + (r.end - r.start), 0);
  const talkingFrames = frames.filter((f) => speaking(f.t));
  if (
    TALKING_FORMATS.includes(format) &&
    dur > 0 &&
    speechSec / dur > RULES.captionsSpeechShare &&
    talkingFrames.length >= 3 &&
    talkingFrames.filter((f) => f.text).length / talkingFrames.length < RULES.captionsSeenShare
  ) {
    drafts.push({
      kind: 'no_captions',
      level: 'warn',
      startSec: 0,
      endSec: dur,
      wholeVideo: true,
      title: 'No captions',
      saw: `Someone talks for ${Math.round((speechSec / dur) * 100)}% of the video, but we saw captions in almost none of those frames.`,
      fix: 'Many people start Shorts muted. Add large captions in the middle of the frame.',
      evidence: [M('speech'), EST],
    });
  }

  // A result shown in the opening is a teaser, not the payoff: look only in the later part.
  const payoff = [...frames].reverse().find((f) => f.showsResult && f.t >= dur * RULES.payoffMinShare);
  if (payoff && payoff.t < dur) {
    const tail = dur - payoff.t;
    if (tail > Math.max(RULES.tailMinSec, RULES.tailMaxShare * dur)) {
      drafts.push({
        kind: 'long_tail',
        level: 'warn',
        startSec: round(payoff.t, 2),
        endSec: dur,
        title: 'Long tail after the payoff',
        saw: `The payoff shows at ${formatTime(payoff.t)}, then ${round(tail)}s more follow.`,
        fix: 'End within a second or two of the payoff. Once viewers have seen it, they leave.',
        evidence: [EST],
      });
    }
  }

  const lastFrame = frames[frames.length - 1];
  if (dur > 0 && signals.loopSimilarity >= RULES.loopMin) {
    drafts.push({
      kind: 'loops_well',
      level: 'good',
      startSec: round(Math.max(0, dur - 1), 2),
      endSec: dur,
      title: 'Loops back to the start',
      saw: `The last frame is ${Math.round(signals.loopSimilarity * 100)}% like the first, so the replay feels seamless.`,
      fix: 'A seamless loop gets watched again, which adds watch time.',
      evidence: [M('motion')],
    });
  } else if (lastFrame && lastFrame.t >= dur - 2 && !lastFrame.action) {
    drafts.push({
      kind: 'no_loop',
      level: 'warn',
      startSec: round(Math.max(0, dur - 1.5), 2),
      endSec: dur,
      title: 'Ends on a still frame',
      saw: `The video ends on a still frame that doesn’t match the opening (${Math.round(signals.loopSimilarity * 100)}% alike).`,
      fix: 'Cut the end card, or end on a shot that leads back into the first frame so the replay feels seamless.',
      evidence: [M('motion'), EST],
    });
  }

  const marked = frames.filter((f) => f.watermark !== 'none');
  if (marked.length >= RULES.minFramesForFlag) {
    const app = { tiktok: 'TikTok', capcut: 'CapCut', other: 'another app’s', none: '' }[marked[0].watermark];
    drafts.push({
      kind: 'watermark',
      level: 'bad',
      startSec: round(Math.max(0, marked[0].t - 0.5), 2),
      endSec: round(Math.min(dur, marked[marked.length - 1].t + 0.5), 2),
      title: 'Another app’s watermark',
      saw: `A ${app} watermark shows in ${marked.length} frames.`,
      fix: 'Export without the watermark. YouTube can show less of content that looks re-uploaded from another app.',
      evidence: [EST],
    });
  }

  const reused = frames.filter((f) => f.looksReused);
  if (reused.length >= RULES.minFramesForFlag) {
    drafts.push({
      kind: 'reused_content',
      level: 'warn',
      startSec: round(Math.max(0, reused[0].t - 0.5), 2),
      endSec: round(Math.min(dur, reused[reused.length - 1].t + 0.5), 2),
      title: 'May count as reused content',
      saw: `${reused.length} frames look like footage from TV, a film or another creator. This is the model’s guess.`,
      fix: 'If it isn’t your footage, add your own commentary or editing. Reused clips can fail YouTube’s monetization review.',
      evidence: [EST],
    });
  }

  // ── File and sound ─────────────────────────────────────────────────────────
  const audibleLevels = signals.loudness.filter((db) => db > RULES.silenceDb);
  const avgDb = audibleLevels.length ? audibleLevels.reduce((a, b) => a + b, 0) / audibleLevels.length : null;
  if (avgDb !== null && avgDb < RULES.quietDb) {
    drafts.push({
      kind: 'loudness',
      level: 'warn',
      startSec: 0,
      endSec: dur,
      wholeVideo: true,
      title: 'Sound is quiet',
      saw: `The audible parts average ${Math.round(avgDb)} dBFS, quieter than most Shorts.`,
      fix: 'Raise the volume (normalise to about −14 LUFS) so it doesn’t sound weak next to other Shorts.',
      evidence: [M('sound')],
    });
  }
  if (signals.clippingPct > RULES.clippingPct) {
    drafts.push({
      kind: 'loudness',
      level: 'warn',
      startSec: 0,
      endSec: dur,
      wholeVideo: true,
      title: 'Sound is distorted',
      saw: `${signals.clippingPct}% of the audio is at full volume, which usually sounds distorted.`,
      fix: 'Lower the volume a little before exporting so the loudest parts don’t clip.',
      evidence: [M('sound')],
    });
  }
  if (signals.width >= signals.height) {
    drafts.push({
      kind: 'format',
      level: 'warn',
      startSec: 0,
      endSec: dur,
      wholeVideo: true,
      title: 'Not vertical',
      saw: `The video is ${signals.width}×${signals.height}.`,
      fix: 'Shorts fill the phone screen at 9:16 (1080×1920). Re-frame it vertically.',
      evidence: [M('file')],
    });
  } else if (signals.letterboxed) {
    drafts.push({
      kind: 'format',
      level: 'warn',
      startSec: 0,
      endSec: dur,
      wholeVideo: true,
      title: 'Black bars',
      saw: 'A horizontal video sits inside the vertical frame with black bars above and below.',
      fix: 'Crop or re-frame to fill 9:16. Black bars waste most of the screen.',
      evidence: [M('file')],
    });
  }

  const mismatch = languageMismatch(signals.speechLanguage, metadata.title);
  if (mismatch) {
    drafts.push({
      kind: 'language_mismatch',
      level: 'warn',
      startSec: 0,
      endSec: dur,
      wholeVideo: true,
      title: 'Title and speech in different languages',
      saw: mismatch,
      fix: 'Write the title in the language you speak, so YouTube shows the Short to people who understand it.',
      evidence: [M('speech'), M('file')],
    });
  }

  // ── Against the connected channel ──────────────────────────────────────────
  const profile = channel?.profile ?? null;
  const fit = profile?.fit ?? null;
  if (profile && fit && profile.videoCount >= RULES.minFitVideos) {
    const gap = fit.typical - fit.score;
    const closest = fit.closest.map((c) => `“${c.title}”${c.views !== null ? ` (${c.views.toLocaleString('en-US')} views)` : ''}`).join(', ');
    if (gap >= RULES.offTopicMargin) {
      drafts.push({
        kind: 'off_topic',
        level: gap >= RULES.farOffTopicMargin ? 'bad' : 'warn',
        startSec: 0,
        endSec: dur,
        wholeVideo: true,
        title: 'Doesn’t match your channel',
        saw: `This Short is about “${fit.topic}”. Your recent videos are about other things; the closest are ${closest}.`,
        fix: 'YouTube learns who watches your channel. A Short far from your usual topics can be shown to the wrong people first and lose the test. If this is a new direction, post several Shorts on it so YouTube can find the new audience; otherwise stay close to the topics your viewers came for.',
        evidence: [{ source: 'topic', measured: false }],
      });
    } else if (gap <= RULES.onTopicMargin) {
      drafts.push({
        kind: 'channel_fit',
        level: 'good',
        startSec: 0,
        endSec: dur,
        wholeVideo: true,
        title: 'Fits your channel',
        saw: `This Short is about “${fit.topic}”, close to your videos ${closest}.`,
        fix: 'Staying on your channel’s topics helps YouTube show it to people who already like this kind of video.',
        evidence: [{ source: 'topic', measured: false }],
      });
    }
  }
  if (
    profile?.topShortDurationSec &&
    dur > profile.topShortDurationSec * RULES.longerThanUsual &&
    dur - profile.topShortDurationSec >= RULES.longerMinExtraSec
  ) {
    drafts.push({
      kind: 'longer_than_usual',
      level: 'warn',
      startSec: 0,
      endSec: dur,
      wholeVideo: true,
      title: 'Longer than your better Shorts',
      saw: `This Short is ${Math.round(dur)}s long. Your better-performing recent Shorts are about ${Math.round(profile.topShortDurationSec)}s.`,
      fix: 'Longer Shorts must hold attention for longer to win the comparison. Cut anything that doesn’t add to the payoff.',
      evidence: [M('baseline')],
    });
  }

  // ── Real retention wins ────────────────────────────────────────────────────
  const retention = channel?.retention ?? null;
  if (retention && retention.length > 1) {
    applyRetention(drafts, candidates, retention, channel?.usual ?? null, hookEnd);
  } else if (channel?.usual) {
    // Before publishing: how the channel's Shorts usually open, for reference.
    const hook = drafts.find((d) => d.kind === 'strong_hook' || d.kind === 'slow_hook' || d.kind === 'quiet_open');
    const norm = pctAt(channel.usual, hookEnd);
    if (hook && norm !== null) {
      hook.saw += ` For reference, your usual Short keeps ${Math.round(norm)}% of viewers at ${formatTime(hookEnd)}.`;
      hook.evidence = [...hook.evidence, M('baseline')];
    }
  }

  // A finding that covers most of the video isn't a moment: list it, don't paint the timeline with it.
  for (const d of drafts) {
    if (!d.wholeVideo && d.endSec - d.startSec >= dur * RULES.mostOfVideoShare) d.wholeVideo = true;
  }

  const issues: TimelineIssue[] = drafts
    .sort((a, b) => a.startSec - b.startSec || levelRank(a.level) - levelRank(b.level))
    .map((d, i) => ({ ...d, id: `${d.kind}-${i}` }));

  const counts: Record<Level, number> = { bad: 0, warn: 0, good: 0 };
  for (const issue of issues) counts[issue.level]++;

  return {
    durationSec: dur,
    format,
    formatSource,
    issues,
    metadataChecks: checkMetadata(metadata),
    counts,
    biggestFixId: biggestFix(issues),
    limitations: limitations(input),
  };
}

function applyRetention(drafts: Draft[], candidates: Draft[], retention: RetentionPoint[], usual: RetentionPoint[] | null, hookEnd: number) {
  const drops = findDrops(retention, usual);
  const explained = new Set<Drop>();
  const numbers = (start: number, end: number) => {
    const a = pctAt(retention, start);
    const b = pctAt(retention, end);
    return a !== null && b !== null ? `${Math.round(a)}% → ${Math.round(b)}%` : null;
  };

  for (const d of drafts) {
    if (d.wholeVideo || !RETENTION_CHECKED.includes(d.kind)) continue;
    const span = numbers(d.startSec, d.endSec);
    if (!span) continue;
    const drop = drops.find((x) => overlap(x, { start: d.startSec, end: d.endSec }) > 0);
    if (drop) {
      explained.add(drop);
      d.level = 'bad';
      d.saw += ` Viewers fell from ${Math.round(drop.fromPct)}% to ${Math.round(drop.toPct)}% here.`;
      d.evidence = [...d.evidence, M('retention')];
      continue;
    }
    const fall = fallPerSec(retention, d.startSec, d.endSec);
    if (fall !== null && fall <= RULES.flatDropPerSec) {
      d.evidence = [...d.evidence, M('retention')];
      if (d.level === 'bad') {
        d.level = 'warn';
        d.saw += ` But your viewers stayed here (${span}), so it may be fine.`;
      } else {
        d.level = 'good';
        d.title = `${d.title}, but viewers stayed`;
        d.fix = `Your retention stays almost flat here (${span}), so viewers are fine with it. No change needed.`;
      }
    }
  }

  for (const c of candidates) {
    const span = numbers(c.startSec, c.endSec);
    if (!span) continue;
    const drop = drops.find((x) => overlap(x, { start: c.startSec, end: c.endSec }) > 0);
    if (drop) {
      explained.add(drop);
      drafts.push({
        ...c,
        level: 'bad',
        title: 'No talking here, and viewers left',
        saw: `${c.saw} Viewers fell from ${Math.round(drop.fromPct)}% to ${Math.round(drop.toPct)}% here.`,
        fix: 'Shorten this part, or add a line, a caption or a stronger moment to keep viewers.',
        evidence: [...c.evidence, M('retention')],
      });
      continue;
    }
    const fall = fallPerSec(retention, c.startSec, c.endSec);
    if (fall !== null && fall <= RULES.flatDropPerSec) {
      drafts.push({
        ...c,
        kind: 'holds_attention',
        level: 'good',
        title: 'No talking, but it holds',
        fix: `For this kind of Short, silence with action and sound works: your retention stays almost flat (${span}).`,
        evidence: [...c.evidence, M('retention')],
      });
    }
  }

  // The opening, against the channel's usual Short.
  const hook = drafts.find((d) => d.kind === 'strong_hook' || d.kind === 'slow_hook' || d.kind === 'quiet_open');
  const here = pctAt(retention, hookEnd);
  const norm = usual ? pctAt(usual, hookEnd) : null;
  if (hook && here !== null) {
    hook.evidence = [...hook.evidence, M('retention'), ...(norm !== null ? [M('baseline')] : [])];
    hook.saw += norm !== null
      ? ` ${Math.round(here)}% are still watching at ${formatTime(hookEnd)}; your usual Short keeps ${Math.round(norm)}%.`
      : ` ${Math.round(here)}% are still watching at ${formatTime(hookEnd)}.`;
    if (norm !== null && hook.kind === 'strong_hook' && here < norm - 10) {
      hook.level = 'warn';
      hook.title = 'Opening looks strong, but viewers leave';
      hook.fix = 'The opening has action, yet more people swipe than on your usual Short. Try showing the result or the key moment even earlier.';
    }
    if (norm !== null && hook.kind !== 'strong_hook' && here >= norm) {
      hook.level = 'warn';
      hook.fix += ' Your viewers still stay as well as usual, so this is a smaller risk here.';
    }
  }

  // Drops nothing explains.
  for (const drop of drops) {
    if (explained.has(drop)) continue;
    if (drafts.some((d) => !d.wholeVideo && d.level !== 'good' && overlap(drop, { start: d.startSec, end: d.endSec }) > 0)) continue;
    drafts.push({
      kind: 'retention_drop',
      level: 'bad',
      startSec: drop.start,
      endSec: drop.end,
      title: 'Viewers left here',
      saw: `Viewers fell from ${Math.round(drop.fromPct)}% to ${Math.round(drop.toPct)}% between ${formatTime(drop.start)} and ${formatTime(drop.end)}, faster than ${
        usual ? 'on your usual Short' : 'normal'
      }. We couldn’t see a clear reason in the video.`,
      fix: 'Watch this part. Look for a slow line, a repeated point, or a moment where the opening’s promise already feels done.',
      evidence: [M('retention'), ...(usual ? [M('baseline')] : [])],
    });
  }
}

/**
 * Ranges of the timeline covered by frames that pass `test` (each frame covers half the gap to its
 * neighbours). The vision model misreads single frames, so fewer than `RULES.minFramesForFlag`
 * matching frames give no range at all.
 */
function frameRanges(frames: FrameFinding[], test: (f: FrameFinding) => boolean, dur: number): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  if (frames.filter(test).length < RULES.minFramesForFlag) return ranges;
  frames.forEach((f, i) => {
    if (!test(f)) return;
    const prev = frames[i - 1]?.t ?? 0;
    const next = frames[i + 1]?.t ?? dur;
    const start = round(Math.max(0, f.t - Math.max(0.25, Math.min(0.5, (f.t - prev) / 2))), 2);
    const end = round(Math.min(dur, f.t + Math.max(0.25, Math.min(0.5, (next - f.t) / 2))), 2);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end + 1) last.end = Math.max(last.end, end);
    else ranges.push({ start, end: Math.max(end, start + 0.5) });
  });
  return ranges;
}

function overlap(a: { start: number; end: number }, b: { start: number; end: number }): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

const levelRank = (l: Level) => ({ bad: 0, warn: 1, good: 2 })[l];

function sentence(parts: (string | null)[]): string {
  const list = parts.filter(Boolean) as string[];
  if (list.length === 0) return '';
  let text = list[0];
  for (let i = 1; i < list.length; i++) {
    const part = list[i].replace(/^and /, '');
    text += i === list.length - 1 ? `${list.length > 2 ? ',' : ''} and ${part}` : `, ${part}`;
  }
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The problem to fix first: a red finding confirmed by retention, else the longest red one, else the longest yellow one. */
function biggestFix(issues: TimelineIssue[]): string | null {
  // Retention-confirmed problems first, then an off-topic Short (it can sink the whole video), then the longest.
  const score = (i: TimelineIssue) =>
    (i.evidence.some((e) => e.source === 'retention') ? 1000 : 0) + (i.kind === 'off_topic' ? 500 : 0) + (i.wholeVideo ? 0 : i.endSec - i.startSec);
  for (const level of ['bad', 'warn'] as const) {
    const list = issues.filter((i) => i.level === level).sort((a, b) => score(b) - score(a));
    if (list.length) return list[0].id;
  }
  return null;
}

const BENGALI = /[ঀ-৿]/g;
const LATIN = /[A-Za-z]/g;

function languageMismatch(speechLanguage: string | null, title: string): string | null {
  if (!speechLanguage || !title.trim()) return null;
  const bengali = title.match(BENGALI)?.length ?? 0;
  const latin = title.replace(/#\S+/g, '').match(LATIN)?.length ?? 0;
  if (bengali + latin < 6) return null;
  const titleIsBangla = bengali / (bengali + latin) >= 0.3;
  if (speechLanguage === 'bn' && !titleIsBangla) return 'You speak Bangla, but the title is in English.';
  if (speechLanguage === 'en' && titleIsBangla) return 'You speak English, but the title is in Bangla.';
  return null;
}

function checkMetadata({ title, hashtags }: EngineInput['metadata']): MetadataCheck[] {
  const checks: MetadataCheck[] = [];
  const clean = title.trim();
  if (!clean) return checks;
  const titleTags = clean.match(/#[^\s#]+/g) ?? [];
  const words = clean.replace(/#[^\s#]+/g, '').trim().split(/\s+/).filter(Boolean);
  const allTags = Array.from(new Set([...hashtags, ...titleTags].map((h) => h.toLowerCase())));

  if (words.length < 3) checks.push({ id: 'topic', level: 'warn', text: 'Say the topic in a few plain words. YouTube uses the title to understand who to show the Short to, and search uses it too.' });
  else checks.push({ id: 'topic', level: 'good', text: 'The title names a topic in plain words, which helps YouTube and search understand the Short.' });
  if (clean.length > 100) checks.push({ id: 'length', level: 'warn', text: `The title is ${clean.length} characters; YouTube allows 100.` });
  if (allTags.length === 0) checks.push({ id: 'tags', level: 'warn', text: 'Add 1–3 hashtags about the topic. They help YouTube place the Short and show it on hashtag pages.' });
  else if (allTags.length > 3) checks.push({ id: 'tags', level: 'warn', text: `${allTags.length} hashtags: use the 1–3 most relevant. More doesn’t help and can look like spam.` });
  else checks.push({ id: 'tags', level: 'good', text: `${allTags.length} hashtag${allTags.length > 1 ? 's' : ''}: a good number.` });
  return checks;
}

function limitations({ signals, vision, channel }: EngineInput): string[] {
  const out = [...vision.failed];
  if (!channel) out.push('Not compared with a channel: connect your channel to also check whether this Short fits it, and to compare with your usual Short.');
  else out.push(...channel.notes);
  if (signals.speech.length === 0) out.push('No speech was found. If someone talks in this Short, the transcription may have failed.');
  out.push('We don’t predict views. These are risks we can see in the video and, with your data, what viewers actually did.');
  return out;
}
