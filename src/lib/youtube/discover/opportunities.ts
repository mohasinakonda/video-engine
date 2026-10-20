/**
 * Deterministic opportunity engine (docs/discover-plan.md §6.5, §7, §9): momentum, content
 * gaps, a transparent weighted score and a separate confidence, each with evidence built
 * from measured numbers. Pure: no network. The model never sets a number here.
 */
import { DISCOVER_RULES } from '../analysis/rules-config';
import { median, minConfidence } from '../analysis/stats';
import type { OpportunityWeights } from '../settings';
import { CONFIDENCE_MIN_VIDEOS, trackRecordFor, type TrackRecordInput, type TrackRecordSignal } from '../create/track-record';
import type { Confidence } from '../types';
import { FORMAT_LABELS, MECHANISM_LABELS, titleMechanisms, type ContentFormat, type TitleMechanism } from './formats';
import type { TaggedVideo } from './market-patterns';
import { ageInDays } from './outliers';
import type { Phase1Summary } from './phase1';
import { cosine } from './similarity';
import type { GapType, Level, Momentum, Opportunity, OpportunityEvidence, OpportunityScores, Outlier, ResearchWindow, TopicSummary } from './types';

const M = DISCOVER_RULES.momentum;
const G = DISCOVER_RULES.gaps;
const S = DISCOVER_RULES.scoring;

/** How hard a format is for this app's faceless video engine (script → scenes → voice). */
export const FORMAT_DIFFICULTY: Record<ContentFormat, Level> = {
  explainer: 'low',
  list: 'low',
  documentary: 'low',
  compilation: 'low',
  news: 'low',
  case_study: 'low',
  myth_testing: 'medium',
  tutorial: 'medium',
  comparison: 'medium',
  review: 'medium',
  problem_solution: 'medium',
  experiment: 'high',
  challenge: 'high',
  reaction: 'high',
  before_after: 'high',
};

export interface TopicDetail {
  summary: TopicSummary;
  centroid: number[];
  yours: TaggedVideo[];
  theirs: TaggedVideo[];
  /** Competitor standouts on this topic (from the research window). */
  outliers: Outlier[];
}

export interface EngineContext {
  window: ResearchWindow;
  now: Date;
  weights: OpportunityWeights;
  phase1: Phase1Summary | null;
  /** Centre of your best videos' title vectors (outperformers, or all if too few). Null if unknown. */
  yourCentre: number[] | null;
  /** views ÷ channel baseline for every judged competitor video. */
  ratios: Map<string, number>;
  competitorsTotal: number;
  /** Share of saved competitors that could not be read. */
  unavailableShare: number;
  strongEmbedding: boolean;
  /** Your formats with how well they hold viewers (Channel Doctor, avg % viewed). */
  yourFormats: Map<ContentFormat, { videos: number; medianAvgViewPct: number | null }>;
  /** How your measured Create videos did, by format and topic. Null when there are none. */
  trackRecord?: TrackRecordInput | null;
}

const periodLabel = (w: ResearchWindow) => (w === '30d' ? 'Last 30 days' : 'Last 90 days');
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

// ─── Momentum ────────────────────────────────────────────────────────────────

export function momentumOf(detail: TopicDetail, ratios: Map<string, number>, now: Date): Momentum {
  const theirs = detail.theirs;
  const last30 = theirs.filter((v) => ageInDays(v.publishedAt, now) <= 30);
  const last90 = theirs.filter((v) => ageInDays(v.publishedAt, now) <= 90);
  const recentOutlier = detail.outliers.some((o) => o.ageDays <= 30);
  if (
    new Set(last30.map((v) => v.channelId)).size >= M.recentChannels &&
    last90.length > 0 &&
    last30.length / last90.length >= M.recentShare &&
    recentOutlier
  ) {
    return 'recent';
  }

  const months = new Set(theirs.filter((v) => ageInDays(v.publishedAt, now) <= 182).map((v) => v.publishedAt.slice(0, 7)));
  const judged = theirs.map((v) => ratios.get(v.id)).filter((r): r is number => r !== undefined);
  const medianRatio = median(judged);
  if (months.size >= M.durableMonths && new Set(theirs.map((v) => v.channelId)).size >= 2 && medianRatio !== null && medianRatio >= 1) {
    return 'durable';
  }

  if (detail.outliers.length >= 1 && new Set(detail.outliers.map((o) => o.channelId)).size === 1) return 'one_off';
  return 'none';
}

// ─── Gaps ────────────────────────────────────────────────────────────────────

export interface GapFinding {
  type: GapType;
  evidence: string;
}

/** The format most standouts share, if one covers at least half of them (and 2+ standouts). */
export function dominantFormat(outliers: Outlier[]): ContentFormat | null {
  if (outliers.length < G.minOutliers) return null;
  const counts = new Map<ContentFormat, number>();
  for (const o of outliers) if (o.contentFormat) counts.set(o.contentFormat, (counts.get(o.contentFormat) ?? 0) + 1);
  const [best] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return best && best[1] / outliers.length >= G.dominantShare ? best[0] : null;
}

function dominantMechanisms(outliers: Outlier[]): TitleMechanism[] {
  if (outliers.length < G.minOutliers) return [];
  const counts = new Map<TitleMechanism, number>();
  for (const o of outliers) for (const m of o.mechanisms ?? titleMechanisms(o.title)) counts.set(m, (counts.get(m) ?? 0) + 1);
  return Array.from(counts.entries())
    .filter(([, n]) => n / outliers.length >= G.dominantShare)
    .map(([m]) => m);
}

export function gapsOf(detail: TopicDetail, momentum: Momentum, phase1: Phase1Summary | null): GapFinding[] {
  const s = detail.summary;
  const gaps: GapFinding[] = [];

  if (s.yourVideoCount <= G.maxYourVideos && s.outlierCount >= G.minOutliers && s.outlierChannelCount >= G.minOutlierChannels) {
    gaps.push({
      type: 'coverage',
      evidence: `${plural(s.outlierCount, 'standout video')} from ${plural(s.outlierChannelCount, 'competitor')} on this topic, while your channel has ${s.yourVideoCount === 0 ? 'none' : 'only 1'} in the analyzed sample.`,
    });
  }

  if (s.problemOriented && s.competitorChannelCount >= G.problemChannels && s.yourVideoCount <= G.maxYourVideos) {
    gaps.push({
      type: 'audience_problem',
      evidence: `${s.competitorChannelCount} competitors address a viewer need here${s.audienceProblem ? ` (“${s.audienceProblem}”, as read by AI)` : ''}; your channel has ${s.yourVideoCount === 0 ? 'no video' : '1 video'} on it.`,
    });
  }

  const format = dominantFormat(detail.outliers);
  if (format && s.yourVideoCount >= 2 && !detail.yours.some((v) => v.format.primary === format)) {
    const yourFormats = Array.from(new Set(detail.yours.map((v) => v.format.primary).filter(Boolean))) as ContentFormat[];
    gaps.push({
      type: 'format',
      evidence: `Most standouts on this topic are ${FORMAT_LABELS[format]} videos; your ${detail.yours.length} videos on it are ${yourFormats.length ? yourFormats.map((f) => FORMAT_LABELS[f]).join(', ') : 'other formats'}.`,
    });
  }

  if (detail.yours.length >= 1) {
    const yourMechanisms = new Set(detail.yours.flatMap((v) => titleMechanisms(v.title)));
    const missing = dominantMechanisms(detail.outliers).filter((m) => !yourMechanisms.has(m));
    const weak = detail.yours.filter((v) => phase1?.videos.get(v.id)?.label === 'underperformer');
    if (missing.length > 0 && (weak.length > 0 || phase1 === null)) {
      gaps.push({
        type: 'packaging',
        evidence: `Standouts here use ${missing.map((m) => MECHANISM_LABELS[m]).join(' and ')} in their titles; none of your ${detail.yours.length} titles on this topic do${weak.length ? `, and ${plural(weak.length, 'of them', 'of them')} underperformed on your channel` : ''}.`,
      });
    }
  }

  if (momentum === 'recent' && s.competitorVideoCount <= G.emergingMaxVideos) {
    gaps.push({
      type: 'emerging',
      evidence: `Emerging signal: ${s.competitorRecent30} of the competitor videos on this topic are from the last 30 days, and only ${s.competitorVideoCount} exist in the sample. Requires validation.`,
    });
  }
  return gaps;
}

// ─── Format, competition and scoring ─────────────────────────────────────────

/** The format to suggest: what the standouts share, steered by Channel Doctor when retention is weak. */
export function recommendFormat(detail: TopicDetail, ctx: EngineContext): ContentFormat | null {
  const fromMarket = dominantFormat(detail.outliers) ?? detail.summary.topFormats[0]?.format ?? null;
  if (ctx.phase1?.primary === 'retention') {
    // Fix retention first: reuse the format that already holds your viewers best, if the topic uses it.
    const strongest = strongestFormat(ctx);
    if (strongest && detail.summary.topFormats.some((f) => f.format === strongest)) return strongest;
  }
  return fromMarket;
}

function strongestFormat(ctx: EngineContext): ContentFormat | null {
  let best: { format: ContentFormat; avp: number } | null = null;
  ctx.yourFormats.forEach((v, format) => {
    if (v.videos >= 2 && v.medianAvgViewPct !== null && (!best || v.medianAvgViewPct > best.avp)) best = { format, avp: v.medianAvgViewPct };
  });
  return (best as { format: ContentFormat } | null)?.format ?? null;
}

export function competitionOf(s: TopicSummary, competitorsTotal: number): { level: Level; score: number } {
  const channelShare = competitorsTotal > 0 ? s.competitorChannelCount / competitorsTotal : 0;
  const saturation = 0.6 * Math.min(1, channelShare) + 0.4 * Math.min(1, s.competitorRecent30 / 10);
  return { level: saturation < 0.34 ? 'low' : saturation < 0.67 ? 'medium' : 'high', score: clamp(100 - saturation * 100) };
}

function performanceScore(detail: TopicDetail, ratios: Map<string, number>): number | null {
  const fromOutliers = median(detail.outliers.map((o) => o.ratio));
  const r = fromOutliers ?? median(detail.theirs.map((v) => ratios.get(v.id)).filter((x): x is number => x !== undefined));
  if (r === null) return null;
  if (r <= 1) return 0;
  const l = Math.log2(r);
  return clamp(l <= 1 ? 50 * l : 50 + 25 * (l - 1));
}

function fitScore(detail: TopicDetail, ctx: EngineContext, format: ContentFormat | null): number | null {
  if (!ctx.yourCentre || detail.centroid.length === 0) return null;
  const sim = cosine(detail.centroid, ctx.yourCentre);
  const base = ((sim - S.fitFloor) / (S.fitCeiling - S.fitFloor)) * 100;
  const formatBonus = format && ctx.yourFormats.has(format) ? 10 : 0;
  return clamp(base + formatBonus);
}

function phase1Score(gaps: GapType[], format: ContentFormat | null, fit: number | null, ctx: EngineContext): { score: number | null; note: string | null } {
  const p = ctx.phase1;
  if (!p || !p.primary) return { score: null, note: null };
  const difficulty = format ? FORMAT_DIFFICULTY[format] : null;
  switch (p.primary) {
    case 'retention': {
      const strongest = strongestFormat(ctx);
      return format && format === strongest
        ? { score: 90, note: `Channel Doctor found viewers leave early; this uses your format that holds viewers best (${FORMAT_LABELS[format]}).` }
        : { score: 0, note: 'Channel Doctor found viewers leave early; this needs a format you haven’t proven yet, so fix retention first.' };
    }
    case 'packaging':
      return gaps.includes('packaging')
        ? { score: 100, note: 'Channel Doctor found packaging is your main problem; here the topic is proven and titles are the lever.' }
        : { score: 50, note: null };
    case 'topic':
      return (gaps.includes('coverage') || gaps.includes('emerging')) && (fit ?? 0) >= 50
        ? { score: 90, note: 'Channel Doctor found your topics are the main problem; this is a new topic that is still close to your audience.' }
        : { score: 40, note: null };
    case 'consistency':
      return difficulty === 'low'
        ? { score: 90, note: 'Channel Doctor found uploads are irregular; this format is quick to produce.' }
        : { score: 40, note: null };
    default:
      return { score: 50, note: null };
  }
}

/** Weighted total over the signals that exist; missing signals are dropped and the rest renormalized. */
export function weightedTotal(scores: Omit<OpportunityScores, 'total'>, weights: OpportunityWeights): { total: number; used: number } {
  let sum = 0;
  let weight = 0;
  let used = 0;
  (Object.keys(weights) as (keyof OpportunityWeights)[]).forEach((key) => {
    const value = scores[key];
    if (value === null || value === undefined) return;
    sum += value * weights[key];
    weight += weights[key];
    used += 1;
  });
  return { total: weight > 0 ? Math.round(sum / weight) : 0, used };
}

// ─── Confidence (separate from the score) ────────────────────────────────────

export function confidenceOf(
  detail: TopicDetail,
  momentum: Momentum,
  gaps: GapType[],
  fit: number | null,
  ctx: EngineContext
): { confidence: Confidence; reasons: string[] } {
  const s = detail.summary;
  const reasons: string[] = [];
  let c: Confidence;

  if (s.competitorChannelCount < 2) {
    c = 'low';
    reasons.push(`Only ${plural(s.competitorChannelCount, 'competitor')} covers this topic.`);
  } else if (s.competitorChannelCount >= 4 && s.outlierCount >= 3) {
    c = 'high';
    reasons.push(`${s.competitorChannelCount} competitors and ${s.outlierCount} standout videos support it.`);
  } else {
    c = 'medium';
    reasons.push(`${s.competitorChannelCount} competitors and ${plural(s.outlierCount, 'standout video')} support it.`);
  }

  if (ctx.unavailableShare >= 0.3) {
    c = 'low';
    reasons.push('Several of your competitors could not be read.');
  }

  const agreeing = [gaps.length > 0, momentum === 'recent' || momentum === 'durable', (fit ?? 0) >= 60].filter(Boolean).length;
  if (agreeing <= 1 && c !== 'low') {
    c = c === 'high' ? 'medium' : 'low';
    reasons.push('The signals don’t all point the same way.');
  }

  if (detail.theirs.length > 0 && detail.theirs.every((v) => ageInDays(v.publishedAt, ctx.now) > 90)) {
    c = 'low';
    reasons.push('All competitor videos on it are older than 90 days.');
  }
  if (momentum === 'one_off') {
    c = 'low';
    reasons.push('It rests on a single standout video (a one-off spike).');
  }
  if (s.cohesion < 0.6 || !ctx.strongEmbedding) {
    c = minConfidence(c, 'medium');
    reasons.push('The topic group is loose, so matching is less certain.');
  }
  if (gaps.length > 0 && gaps.every((g) => g === 'audience_problem')) {
    c = minConfidence(c, 'medium');
    reasons.push('The viewer need was read by AI from titles.');
  }
  return { confidence: c, reasons };
}

/**
 * Your own results can raise confidence, but only with enough videos behind them; a poor
 * record is stated as a reason without hiding the idea.
 */
export function withTrackRecord(judged: { confidence: Confidence; reasons: string[] }, track: TrackRecordSignal | null): { confidence: Confidence; reasons: string[] } {
  if (!track) return judged;
  if (track.n >= CONFIDENCE_MIN_VIDEOS && track.effect >= 0.3) {
    const raised: Confidence = judged.confidence === 'low' ? 'medium' : 'high';
    return { confidence: raised, reasons: [...judged.reasons, 'Your own past videos like this did better than your usual.'] };
  }
  if (track.effect <= -0.3) return { ...judged, reasons: [...judged.reasons, 'Your own past videos like this did worse than your usual.'] };
  return judged;
}

// ─── Building opportunities ──────────────────────────────────────────────────

const toLevel = (score: number | null): Level => (score === null ? 'low' : score >= 67 ? 'high' : score >= 34 ? 'medium' : 'low');

/** Scores every topic with a market signal and returns the strongest, ranked. */
export function buildOpportunities(details: TopicDetail[], ctx: EngineContext): Opportunity[] {
  const period = periodLabel(ctx.window);
  const opportunities: Opportunity[] = [];

  for (const detail of details) {
    const s = detail.summary;
    if (s.competitorVideoCount === 0) continue;

    const momentum = momentumOf(detail, ctx.ratios, ctx.now);
    const gaps = gapsOf(detail, momentum, ctx.phase1);
    const gapTypes = gaps.map((g) => g.type);
    const format = recommendFormat(detail, ctx);
    const fit = fitScore(detail, ctx, format);
    // Nothing to act on: no gap and no standout on the topic.
    if (gapTypes.length === 0 && s.outlierCount === 0) continue;

    const competition = competitionOf(s, ctx.competitorsTotal);
    const difficulty = format ? FORMAT_DIFFICULTY[format] : null;
    const p1 = phase1Score(gapTypes, format, fit, ctx);
    const track = trackRecordFor(format, detail.centroid, ctx.trackRecord ?? null, format ? FORMAT_LABELS[format] : undefined);
    const partial: Omit<OpportunityScores, 'total'> = {
      channelFit: fit,
      competitorPerformance: performanceScore(detail, ctx.ratios),
      momentum: S.momentumScores[momentum],
      contentGap: gapTypes.length ? Math.max(...gapTypes.map((g) => S.gapScores[g])) : 0,
      competition: competition.score,
      productionFit: difficulty ? S.difficultyScores[difficulty] : null,
      phase1: p1.score,
      trackRecord: track?.score ?? null,
    };
    const { total, used } = weightedTotal(partial, ctx.weights);
    const judged = confidenceOf(detail, momentum, gapTypes, fit, ctx);
    const { confidence, reasons } = withTrackRecord(judged, track);

    const evidence: OpportunityEvidence[] = [];
    const add = (statement: string, source: OpportunityEvidence['source'], calculation?: string) =>
      evidence.push({ id: `ev_${s.id}_${evidence.length + 1}`, statement, source, period, ...(calculation && { calculation }) });

    if (s.outlierCount > 0) {
      const ratios = detail.outliers.map((o) => o.ratio);
      add(
        `${plural(s.outlierCount, 'competitor video')} on this topic beat ${s.outlierChannelCount === 1 ? 'its channel’s' : 'their channels’'} usual views (median ${median(ratios)?.toFixed(1)}×).`,
        'calculated',
        'Views ÷ the median views of that channel’s same-format videos aged 7–365 days.'
      );
    }
    add(`${plural(s.competitorChannelCount, 'competitor')} published ${plural(s.competitorVideoCount, 'video')} on this topic${s.competitorRecent30 ? `, ${s.competitorRecent30} in the last 30 days` : ''}.`, 'youtube_public');
    add(
      s.yourVideoCount === 0 ? 'Your channel has no videos on this topic in the analyzed sample.' : `Your channel has ${plural(s.yourVideoCount, 'video')} on this topic.`,
      'youtube_public'
    );
    for (const g of gaps) add(g.evidence, 'calculated');
    if (p1.note) add(p1.note, 'youtube_analytics');
    if (track) add(track.evidence, 'youtube_analytics', 'Your measured Create videos, each compared with your usual videos at the same age.');

    opportunities.push({
      version: 1,
      id: `opp_${ctx.window}_${s.id}`,
      topicId: s.id,
      topic: s.label,
      recommendedAngle: null,
      angleSource: null,
      angleRationale: null,
      whyNow: null,
      audience: null,
      problem: s.audienceProblem,
      recommendedFormat: format,
      gapTypes,
      momentum,
      competition: competition.level,
      channelFit: toLevel(fit),
      productionDifficulty: difficulty,
      scores: { total, ...partial },
      signalsUsed: used,
      confidence,
      confidenceReasons: reasons,
      evidence,
      competitorSignals: detail.outliers.slice(0, 8).map((o) => ({
        videoId: o.videoId,
        channelId: o.channelId,
        title: o.title,
        ratio: o.ratio,
        views: o.views,
        baselineViews: o.baselineViews,
        sampleSize: o.sampleSize,
      })),
      yourVideoIds: detail.yours.slice(0, 10).map((v) => v.id),
      yourVideos: detail.yours.slice(0, 10).map((v) => ({ id: v.id, title: v.title, label: ctx.phase1?.videos.get(v.id)?.label ?? null })),
      window: ctx.window,
      generatedAt: ctx.now.toISOString(),
    });
  }

  return opportunities.sort((a, b) => b.scores.total - a.scores.total).slice(0, S.maxOpportunities);
}
