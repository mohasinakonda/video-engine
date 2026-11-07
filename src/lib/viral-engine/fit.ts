/**
 * How close a Short's topic is to what the channel posts, from embedding vectors. Pure.
 *
 * Absolute similarity depends on the model and the wording, so the score is judged against the
 * channel itself: how alike its own videos are to each other ("typical"). A focused channel has a
 * high typical similarity, so a Short that drifts stands out; a varied channel tolerates more.
 */
import { cosine } from '@/lib/youtube/discover/similarity';
import { median, round } from './signals';
import type { TopicFit } from './types';

const TOP_K = 3;

const meanTop = (values: number[], k: number) => {
  const top = [...values].sort((a, b) => b - a).slice(0, k);
  return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
};

export function fitFromVectors(
  topic: string,
  topicVector: number[],
  videos: { title: string; views: number | null; vector: number[] }[]
): TopicFit | null {
  if (videos.length < TOP_K + 1) return null;
  const sims = videos.map((v) => cosine(topicVector, v.vector));
  const score = meanTop(sims, TOP_K);

  // For each of the channel's videos: how close are its nearest siblings?
  const own = videos.map((v, i) => meanTop(videos.filter((_, j) => j !== i).map((w) => cosine(v.vector, w.vector)), TOP_K));
  const typical = median(own) ?? 0;

  const closest = videos
    .map((v, i) => ({ title: v.title, views: v.views, similarity: round(sims[i], 3) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K);

  return { topic, score: round(score, 3), typical: round(typical, 3), closest };
}
