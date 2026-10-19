/**
 * Turns learning rows (read by the route) into what Discover scores with. No database here:
 * research stays database-free; only the topic labels are embedded, with the research's model.
 */
import { embed } from '@/lib/llm-providers';
import { groupBy, latestPerVideo, type LearningRow, type TrackRecordInput } from './track-record';

export async function buildTrackRecordInput(rows: LearningRow[], minVideos: number, embeddingModel: string | null): Promise<TrackRecordInput | null> {
  const latest = latestPerVideo(rows);
  if (latest.length < minVideos) return null;
  const formats = new Map(groupBy(latest, (r) => r.contentFormat).map((g) => [g.key, g]));
  const topicGroups = groupBy(latest, (r) => r.topicLabel?.trim() || null).filter((g) => g.n >= minVideos);
  let topics: TrackRecordInput['topics'] = [];
  if (topicGroups.length && embeddingModel) {
    const embedded = await embed({ texts: topicGroups.map((g) => g.key), models: [embeddingModel], tag: 'create:track-record' });
    if (embedded) topics = topicGroups.map((stat, i) => ({ stat, vector: embedded.vectors[i] }));
  }
  return { minVideos, formats, topics };
}
