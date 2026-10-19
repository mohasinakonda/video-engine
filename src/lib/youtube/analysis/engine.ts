import type {
  ChannelDataset,
  Confidence,
  DeterministicReport,
  Evidence,
  Finding,
  MetricValue,
  RetentionAnomaly,
  VideoAnalysis,
} from '../types';
import { daysBetween } from './period';
import { detectRetentionAnomalies } from './retention';
import { DISCOVERY_SOURCES, RULES, TRAFFIC_LABELS } from './rules-config';
import { coefficientOfVariation, confidenceFromSample, median, minConfidence, percentChange, round } from './stats';
import { titleFeatures } from './titles';
import { analyzeVideos } from './videos';

const pct = (v: number) => `${round(v * 100)}%`;

/**
 * Turns a ChannelDataset into measured findings. Every finding points at evidence, and
 * every evidence sentence is built from the numbers it quotes. No AI involved.
 */
export function analyzeChannel(dataset: ChannelDataset): DeterministicReport {
  const evidence: Evidence[] = [];
  const findings: Finding[] = [];
  const strengths: string[] = [];
  const limitations: string[] = [];

  const add = (e: Evidence) => {
    evidence.push(e);
    return e.id;
  };

  // ── Data limitations ────────────────────────────────────────────────────────
  for (const [label, result] of [
    ['daily', dataset.daily],
    ['totals', dataset.totals],
    ['perVideo', dataset.perVideo],
    ['traffic', dataset.traffic],
  ] as const) {
    if (!result.ok) limitations.push(result.reason);
  }
  if (!dataset.reach.ok) {
    limitations.push(dataset.reach.reason);
  } else if (dataset.reach.data.coveredDays === 0) {
    limitations.push(
      dataset.reach.data.availableFrom
        ? `Impressions and CTR will be available from ${dataset.reach.data.availableFrom}. YouTube needs about two days to prepare them after a channel connects.`
        : 'YouTube has not provided impressions and CTR for this period yet.'
    );
  } else if (dataset.reach.data.coveredDays < dataset.reach.data.totalDays) {
    limitations.push(
      `Impressions and CTR cover ${dataset.reach.data.coveredDays} of ${dataset.reach.data.totalDays} days, because YouTube only prepares them from 30 days before the channel was connected.`
    );
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics = buildMetrics(dataset, limitations);

  // ── Videos ─────────────────────────────────────────────────────────────────
  const videos = analyzeVideos(dataset);
  const withViews = videos.filter((v) => (v.stats?.views ?? 0) > 0);
  const recent = videos.filter((v) => v.format !== null).slice(0, RULES.recentVideos);

  if (withViews.length < RULES.minVideosForDiagnosis) {
    const id = add({
      id: 'ev_insufficient_videos',
      category: 'data',
      statement: `Only ${withViews.length} video${withViews.length === 1 ? '' : 's'} had views in this period, so comparisons between videos are not reliable.`,
      values: { videosWithViews: withViews.length, needed: RULES.minVideosForDiagnosis },
      sampleSize: withViews.length,
      confidence: 'high',
    });
    limitations.push(evidence.find((e) => e.id === id)!.statement);
  }

  // Outperformers are a strength worth repeating.
  const outperformers = videos.filter((v) => v.label === 'outperformer');
  if (outperformers.length > 0) {
    strengths.push(
      add({
        id: 'ev_outperformers',
        category: 'strength',
        statement: `${outperformers.length} video${outperformers.length === 1 ? '' : 's'} got at least ${RULES.outperformerRatio}× the views of comparable videos on your channel: ${outperformers
          .slice(0, 3)
          .map((v) => `"${v.title}" (${round(v.relativeViews ?? 0)}×)`)
          .join(', ')}.`,
        values: { count: outperformers.length },
        sampleSize: outperformers.length,
        confidence: minConfidence('medium', confidenceFromSample(Math.min(...outperformers.map((v) => v.baselineSize)))),
        videoIds: outperformers.map((v) => v.id),
      })
    );
  }

  // ── Packaging (needs CTR) ──────────────────────────────────────────────────
  if (dataset.reach.ok && dataset.reach.data.coveredDays > 0) {
    packagingRule(videos, recent, add, findings);
  }

  // ── Retention ──────────────────────────────────────────────────────────────
  const retentionAnomalies: RetentionAnomaly[] = [];
  for (const [videoId, result] of Object.entries(dataset.retention)) {
    if (!result.ok) continue;
    const video = videos.find((v) => v.id === videoId);
    retentionAnomalies.push(...detectRetentionAnomalies(videoId, result.data, video?.durationSec ?? null, video?.stats?.views ?? 0));
  }
  retentionRule(videos, recent, dataset, retentionAnomalies, add, findings, strengths);

  // ── Topic (hypothesis only) ────────────────────────────────────────────────
  topicRule(recent, videos, findings, add);

  // ── Acquisition ────────────────────────────────────────────────────────────
  if (dataset.traffic.ok) acquisitionRule(dataset, metrics, add, findings, strengths);

  // ── Consistency ────────────────────────────────────────────────────────────
  consistencyRule(dataset, metrics, add, findings);

  // ── Growth strength ────────────────────────────────────────────────────────
  const viewsMetric = metrics.find((m) => m.key === 'views');
  if (viewsMetric?.changePct != null && viewsMetric.changePct >= RULES.growthStrengthPct) {
    strengths.push(
      add({
        id: 'ev_views_growth',
        category: 'strength',
        statement: `Views grew ${round(viewsMetric.changePct)}% compared with the previous ${dataset.current.days} days (${viewsMetric.previous?.toLocaleString()} → ${viewsMetric.value?.toLocaleString()}).`,
        values: { current: viewsMetric.value, previous: viewsMetric.previous, changePct: round(viewsMetric.changePct) },
        sampleSize: dataset.current.days,
        confidence: 'high',
      })
    );
  }

  return {
    metrics,
    videos,
    retentionAnomalies,
    titleFeatures: dataset.videos.map(titleFeatures),
    evidence,
    findings: findings.sort((a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence)),
    strengths,
    limitations,
  };
}

const rankConfidence = (c: Confidence) => ({ low: 0, medium: 1, high: 2 })[c];

function buildMetrics(dataset: ChannelDataset, limitations: string[]): MetricValue[] {
  const cur = dataset.totals.ok ? dataset.totals.data : null;
  const prev = dataset.previousTotals.ok ? dataset.previousTotals.data : null;
  // A previous period with no views (e.g. a new channel) is not a fair comparison.
  const comparable = Boolean(prev && prev.views > 0);
  if (cur && !comparable) {
    limitations.push(`There is no comparable previous period (${dataset.previous.startDate} to ${dataset.previous.endDate} had no views), so changes are not shown.`);
  }

  const metric = (key: MetricValue['key'], value: number | null, previous: number | null, note: string | null = null): MetricValue => ({
    key,
    value,
    previous: comparable ? previous : null,
    changePct: comparable ? percentChange(value, previous) : null,
    note: value === null ? note ?? 'Not available for this period.' : note,
  });

  const reach = dataset.reach.ok && dataset.reach.data.coveredDays > 0 ? dataset.reach.data : null;
  const reachNote = reach && reach.coveredDays < reach.totalDays ? `Covers ${reach.coveredDays} of ${reach.totalDays} days.` : null;
  const reachMissing = dataset.reach.ok
    ? dataset.reach.data.availableFrom
      ? `Available from ${dataset.reach.data.availableFrom}.`
      : 'Not provided by YouTube yet.'
    : 'Not available.';

  return [
    metric('views', cur?.views ?? null, prev?.views ?? null),
    metric('watchHours', cur ? cur.minutesWatched / 60 : null, prev ? prev.minutesWatched / 60 : null),
    metric(
      'netSubscribers',
      cur && cur.subscribersGained !== null && cur.subscribersLost !== null ? cur.subscribersGained - cur.subscribersLost : null,
      prev && prev.subscribersGained !== null && prev.subscribersLost !== null ? prev.subscribersGained - prev.subscribersLost : null
    ),
    metric('avgViewDuration', cur?.avgViewDurationSec ?? null, prev?.avgViewDurationSec ?? null),
    metric('avgViewPct', cur?.avgViewPct ?? null, prev?.avgViewPct ?? null),
    // Previous-period reach isn't fetched (the job usually has no files that far back).
    { key: 'impressions', value: reach?.totalImpressions ?? null, previous: null, changePct: null, note: reach ? reachNote : reachMissing },
    { key: 'ctr', value: reach?.ctr ?? null, previous: null, changePct: null, note: reach ? reachNote : reachMissing },
  ];
}

type AddEvidence = (e: Evidence) => string;

function packagingRule(videos: VideoAnalysis[], recent: VideoAnalysis[], add: AddEvidence, findings: Finding[]) {
  const P = RULES.packaging;
  // CTR is a thumbnail metric; Shorts are mostly swiped to, so only regular videos count.
  const measured = videos.filter((v) => v.format === 'video' && v.ctr !== null && (v.impressions ?? 0) >= P.minImpressions);
  const channelCtr = median(measured.map((v) => v.ctr as number));
  if (channelCtr === null || measured.length < RULES.minBaselineVideos) return;

  const weak = recent.filter(
    (v) => v.format === 'video' && v.ctr !== null && (v.impressions ?? 0) >= P.minImpressions && v.ctr <= channelCtr * P.ctrRatio
  );
  if (weak.length < P.minVideos) return;

  const id = add({
    id: 'ev_ctr_low_recent',
    category: 'packaging',
    statement: `${weak.length} of your last ${recent.length} uploads had a CTR at or below ${P.ctrRatio * 100}% of your channel median (${weak
      .map((v) => pct(v.ctr as number))
      .join(', ')} vs a median of ${pct(channelCtr)}), each with at least ${P.minImpressions.toLocaleString()} impressions.`,
    values: { weakVideos: weak.length, channelMedianCtr: round(channelCtr * 100, 2) },
    sampleSize: measured.length,
    confidence: confidenceFromSample(measured.length),
    videoIds: weak.map((v) => v.id),
  });
  findings.push({ category: 'packaging', evidenceIds: [id], confidence: confidenceFromSample(measured.length), isHypothesis: false });
}

function retentionRule(
  videos: VideoAnalysis[],
  recent: VideoAnalysis[],
  dataset: ChannelDataset,
  anomalies: RetentionAnomaly[],
  add: AddEvidence,
  findings: Finding[],
  strengths: string[]
) {
  const R = RULES.retention;
  const ids: string[] = [];

  // Average % viewed well below the channel's own median, regular videos only.
  const longForm = videos.filter((v) => v.format === 'video' && v.stats?.avgViewPct != null && (v.stats?.views ?? 0) > 0);
  const medianAvp = median(longForm.map((v) => v.stats!.avgViewPct as number));
  if (medianAvp !== null && longForm.length >= RULES.minBaselineVideos) {
    const weak = recent.filter((v) => v.format === 'video' && v.stats?.avgViewPct != null && v.stats.avgViewPct <= medianAvp * R.avpRatio);
    if (weak.length >= R.minVideos) {
      ids.push(
        add({
          id: 'ev_avp_low_recent',
          category: 'retention',
          statement: `${weak.length} recent videos kept viewers for a smaller share of the video than usual (${weak
            .map((v) => `${round(v.stats!.avgViewPct as number)}%`)
            .join(', ')} viewed vs your median of ${round(medianAvp)}%).`,
          values: { weakVideos: weak.length, medianAvgViewPct: round(medianAvp) },
          sampleSize: longForm.length,
          confidence: confidenceFromSample(longForm.length),
          videoIds: weak.map((v) => v.id),
        })
      );
    }
  }

  // Many viewers leaving in the first 30 seconds across the sampled videos.
  const sampled = Object.values(dataset.retention).filter((r) => r.ok).length;
  const earlyExits = anomalies.filter((a) => a.kind === 'early_exit');
  if (sampled > 0 && earlyExits.length >= Math.min(R.minVideos, sampled) && earlyExits.length >= 2) {
    const avgLost = earlyExits.reduce((sum, a) => sum + a.magnitude, 0) / earlyExits.length;
    ids.push(
      add({
        id: 'ev_early_exit',
        category: 'retention',
        statement: `On ${earlyExits.length} of ${sampled} analyzed videos, more than ${round((1 - R.earlyExitWatchRatio) * 100, 0)}% of viewers left within the first ${R.earlyExitSec} seconds (on average ${round(avgLost)}% gone by then).`,
        values: { videos: earlyExits.length, sampled, avgLostPct: round(avgLost) },
        sampleSize: sampled,
        confidence: minConfidence(confidenceFromSample(sampled), 'medium'),
        videoIds: earlyExits.map((a) => a.videoId),
      })
    );
  }

  if (ids.length > 0) {
    findings.push({
      category: 'retention',
      evidenceIds: ids,
      confidence: minConfidence(confidenceFromSample(longForm.length), ids.length > 1 ? 'high' : 'medium'),
      isHypothesis: false,
    });
  } else if (sampled >= 3 && earlyExits.length === 0 && medianAvp !== null) {
    strengths.push(
      add({
        id: 'ev_retention_ok',
        category: 'strength',
        statement: `None of the ${sampled} analyzed videos lost more than ${round((1 - R.earlyExitWatchRatio) * 100, 0)}% of viewers in the first ${R.earlyExitSec} seconds, and viewers watched ${round(medianAvp)}% of a typical video.`,
        values: { sampled, medianAvgViewPct: round(medianAvp) },
        sampleSize: sampled,
        confidence: confidenceFromSample(sampled),
      })
    );
  }
}

function topicRule(recent: VideoAnalysis[], videos: VideoAnalysis[], findings: Finding[], add: AddEvidence) {
  const T = RULES.topic;
  const under = recent.filter((v) => v.label === 'underperformer');
  if (under.length < T.minUnderperformers) return;

  // Only a topic hypothesis when retention and CTR on those videos look normal.
  const medianAvp = median(videos.filter((v) => v.stats?.avgViewPct != null).map((v) => v.stats!.avgViewPct as number));
  const medianCtr = median(videos.filter((v) => v.ctr != null).map((v) => v.ctr as number));
  const normalPackagingAndRetention = under.every(
    (v) =>
      (medianAvp === null || (v.stats?.avgViewPct ?? 0) >= medianAvp * T.normalAvpRatio) &&
      (medianCtr === null || v.ctr === null || v.ctr >= medianCtr * RULES.packaging.ctrRatio)
  );
  if (!normalPackagingAndRetention) return;

  const id = add({
    id: 'ev_topic_underperformers',
    category: 'topic',
    statement: `${under.length} of your last ${recent.length} uploads got half or less of the views of comparable videos (${under
      .map((v) => `"${v.title}" ${round(v.relativeViews ?? 0)}×`)
      .join(', ')}), while their retention${medianCtr !== null ? ' and CTR' : ''} looked normal.`,
    values: { underperformers: under.length },
    sampleSize: under.length,
    confidence: 'low',
    videoIds: under.map((v) => v.id),
  });
  findings.push({ category: 'topic', evidenceIds: [id], confidence: under.length >= 5 ? 'medium' : 'low', isHypothesis: true });
}

function acquisitionRule(
  dataset: ChannelDataset,
  metrics: MetricValue[],
  add: AddEvidence,
  findings: Finding[],
  strengths: string[]
) {
  if (!dataset.traffic.ok) return;
  const A = RULES.acquisition;
  const rows = dataset.traffic.data;
  const total = rows.reduce((sum, r) => sum + r.views, 0);
  if (total === 0) return;
  const discovery = rows.filter((r) => DISCOVERY_SOURCES.has(r.source)).reduce((sum, r) => sum + r.views, 0);
  const share = discovery / total;
  const top = rows
    .slice(0, 3)
    .map((r) => `${TRAFFIC_LABELS[r.source] || r.source} ${pct(r.views / total)}`)
    .join(', ');
  const values = { discoveryShare: round(share * 100), totalViews: total };

  if (share >= A.strongDiscoveryShare) {
    strengths.push(
      add({
        id: 'ev_discovery_strong',
        category: 'strength',
        statement: `${pct(share)} of views came from YouTube recommending your videos (Browse, Suggested and the Shorts feed). Top sources: ${top}.`,
        values,
        sampleSize: total,
        confidence: 'high',
      })
    );
    return;
  }

  const viewsChange = metrics.find((m) => m.key === 'views')?.changePct ?? null;
  if (share < A.lowDiscoveryShare) {
    const id = add({
      id: 'ev_discovery_low',
      category: 'acquisition',
      statement: `Only ${pct(share)} of views came from YouTube recommendations (Browse, Suggested and the Shorts feed). Top sources: ${top}.${
        viewsChange !== null ? ` Views changed ${round(viewsChange)}% versus the previous period.` : ''
      }`,
      values: { ...values, viewsChangePct: viewsChange === null ? null : round(viewsChange) },
      sampleSize: total,
      confidence: viewsChange !== null && viewsChange < 0 ? 'high' : 'medium',
    });
    findings.push({ category: 'acquisition', evidenceIds: [id], confidence: viewsChange !== null && viewsChange < 0 ? 'high' : 'medium', isHypothesis: false });
  }
}

function consistencyRule(dataset: ChannelDataset, metrics: MetricValue[], add: AddEvidence, findings: Finding[]) {
  const C = RULES.consistency;
  const allDates = dataset.videos.map((v) => v.publishedAt).filter(Boolean).sort().reverse();
  if (allDates.length === 0) return;

  const ids: string[] = [];
  const sinceLast = daysBetween(allDates[0], dataset.current.endDate);
  if (sinceLast > C.maxDaysWithoutUpload) {
    ids.push(
      add({
        id: 'ev_no_recent_upload',
        category: 'consistency',
        statement: `Your last upload was ${sinceLast} days before the end of this period (${allDates[0].slice(0, 10)}).`,
        values: { daysSinceLastUpload: sinceLast, lastUpload: allDates[0].slice(0, 10) },
        sampleSize: allDates.length,
        confidence: 'high',
      })
    );
  }

  // Views falling sharply while uploads have paused.
  const views = metrics.find((m) => m.key === 'views');
  if (views?.changePct != null && views.changePct <= C.declinePct && sinceLast >= C.pauseDays) {
    ids.push(
      add({
        id: 'ev_decline_during_pause',
        category: 'consistency',
        statement: `Views fell ${round(Math.abs(views.changePct))}% compared with the previous ${dataset.current.days} days (${views.previous?.toLocaleString()} → ${views.value?.toLocaleString()}), and there has been no new upload for ${sinceLast} days.`,
        values: { changePct: round(views.changePct), daysSinceLastUpload: sinceLast },
        sampleSize: dataset.current.days,
        confidence: 'medium',
      })
    );
  }

  // Schedule regularity on regular videos; Shorts often go out alongside them on the same day.
  const longDates = dataset.videos.filter((v) => v.format === 'video').map((v) => v.publishedAt).sort().reverse();
  const dates = longDates.length >= 5 ? longDates : allDates;
  const sample = dates.slice(0, C.gapSample + 1);
  const gaps = sample.slice(1).map((d, i) => daysBetween(d, sample[i]));
  const variation = coefficientOfVariation(gaps);
  if (variation !== null && gaps.length >= 4 && variation > C.gapVariation && Math.max(...gaps) >= C.minLongGapDays) {
    ids.push(
      add({
        id: 'ev_irregular_uploads',
        category: 'consistency',
        statement: `Your last ${sample.length} ${dates === longDates ? 'regular videos' : 'uploads'} were between ${Math.min(...gaps)} and ${Math.max(...gaps)} days apart.`,
        values: { minGapDays: Math.min(...gaps), maxGapDays: Math.max(...gaps), variation: round(variation, 2) },
        sampleSize: gaps.length,
        confidence: confidenceFromSample(gaps.length, { medium: 4, high: 7 }),
      })
    );
  }

  if (ids.length > 0) {
    findings.push({
      category: 'consistency',
      evidenceIds: ids,
      confidence: ids.includes('ev_no_recent_upload') || ids.includes('ev_decline_during_pause') ? 'high' : 'medium',
      // Linking a decline to the pause is an interpretation; the gaps themselves are measured.
      isHypothesis: ids.length === 1 && ids[0] === 'ev_decline_during_pause',
    });
  }
}
