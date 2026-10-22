/**
 * Turns per-video tags (topic, format, mechanisms) into the market summaries the UI shows.
 * Pure: every count and share is computed here.
 */
import { FORMATS, MECHANISMS, titleMechanisms, type ContentFormat, type FormatTag } from './formats';
import { ageInDays } from './outliers';
import type { RawTopic, TopicInput, TopicLabel } from './topics';
import type { MarketPatterns, MarketVideo, Outlier, TopicSummary } from './types';

export interface TaggedVideo extends MarketVideo {
  channelTitle: string;
  isYours: boolean;
  format: FormatTag;
}

export function summarizeTopics(
  topics: RawTopic[],
  labels: Map<string, TopicLabel>,
  inputs: TopicInput[],
  videosById: Map<string, TaggedVideo>,
  outlierIds: Set<string>,
  now: Date
): TopicSummary[] {
  return topics.map((t) => {
    const videos = t.members.map((i) => videosById.get(inputs[i].id)).filter((v): v is TaggedVideo => Boolean(v));
    const theirs = videos.filter((v) => !v.isYours);
    const yours = videos.filter((v) => v.isYours);
    const outliers = theirs.filter((v) => outlierIds.has(v.id));
    const formatCounts = new Map<ContentFormat, number>();
    for (const v of videos) if (v.format.primary) formatCounts.set(v.format.primary, (formatCounts.get(v.format.primary) ?? 0) + 1);
    const label = labels.get(t.id) as TopicLabel;

    return {
      id: t.id,
      label: label.label,
      labelSource: label.source,
      problemOriented: label.problemOriented,
      audienceProblem: label.audienceProblem,
      videoCount: videos.length,
      yourVideoCount: yours.length,
      competitorVideoCount: theirs.length,
      competitorChannelCount: new Set(theirs.map((v) => v.channelId)).size,
      competitorRecent30: theirs.filter((v) => ageInDays(v.publishedAt, now) <= 30).length,
      outlierCount: outliers.length,
      outlierChannelCount: new Set(outliers.map((v) => v.channelId)).size,
      cohesion: t.cohesion,
      exampleTitles: t.representative.slice(0, 3).map((i) => inputs[i].title),
      topFormats: Array.from(formatCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([format, count]) => ({ format, count })),
      yourVideoIds: yours.slice(0, 10).map((v) => v.id),
      outlierVideoIds: outliers.slice(0, 10).map((v) => v.id),
    };
  });
}

/**
 * Formats and title mechanisms: how common each is among competitor videos in the window,
 * among their outliers, and on your channel. Same population for "all" and "outliers":
 * competitor videos in the window that were old enough to judge.
 */
export function summarizePatterns(eligible: TaggedVideo[], outlierIds: Set<string>, yours: TaggedVideo[]): MarketPatterns {
  const outliers = eligible.filter((v) => outlierIds.has(v.id));
  const share = (list: TaggedVideo[], test: (v: TaggedVideo) => boolean) => (list.length ? list.filter(test).length / list.length : 0);
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const all = [...eligible, ...yours];

  return {
    formats: FORMATS.map((format) => ({
      format,
      competitorVideos: eligible.filter((v) => v.format.primary === format).length,
      competitorOutliers: outliers.filter((v) => v.format.primary === format).length,
      yourVideos: yours.filter((v) => v.format.primary === format).length,
    })).filter((f) => f.competitorVideos + f.yourVideos > 0),
    mechanisms: MECHANISMS.map((mechanism) => {
      const has = (v: TaggedVideo) => titleMechanisms(v.title).includes(mechanism);
      return {
        mechanism,
        outlierShare: round2(share(outliers, has)),
        competitorShare: round2(share(eligible, has)),
        yourShare: round2(share(yours, has)),
      };
    }).filter((m) => m.outlierShare + m.competitorShare + m.yourShare > 0),
    competitorVideos: eligible.length,
    outliers: outliers.length,
    yourVideos: yours.length,
    unclassified: all.filter((v) => !v.format.primary).length,
    aiClassified: all.filter((v) => v.format.source === 'ai').length,
  };
}

/** Adds topic, format and mechanisms to each outlier for display. */
export function tagOutliers(outliers: Outlier[], assignment: Map<string, string>, videosById: Map<string, TaggedVideo>): Outlier[] {
  return outliers.map((o) => ({
    ...o,
    topicId: assignment.get(o.videoId) ?? null,
    contentFormat: videosById.get(o.videoId)?.format.primary ?? null,
    mechanisms: titleMechanisms(o.title),
  }));
}
