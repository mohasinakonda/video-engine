/**
 * Topic clusters across your videos and your competitors' (docs/discover-plan.md §6.3):
 * deterministic preparation and clustering on embeddings, then the model only names the
 * clusters it is given. Counts are always computed here, never by the model.
 */
import { z } from 'zod';
import { callLLM, embed, parseJsonObject } from '@/lib/llm-providers';
import { DISCOVER_RULES } from '../analysis/rules-config';
import { agglomerate, type Cluster } from './clustering';
import { cosine, topicText } from './similarity';

const T = DISCOVER_RULES.topics;

export interface TopicInput {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  isYours: boolean;
}

/** A cluster before it is named. Indexes point into the input list. */
export interface RawTopic {
  id: string;
  members: number[];
  cohesion: number;
  centroid: number[];
  /** Up to 8 titles closest to the centroid, for naming and for examples. */
  representative: number[];
}

export interface TopicLabel {
  label: string;
  source: 'ai' | 'fallback';
  problemOriented: boolean;
  audienceProblem: string | null;
}

export interface TopicBuild {
  topics: RawTopic[];
  labels: Map<string, TopicLabel>;
  /** Video id → topic id, for videos in a kept cluster. */
  assignment: Map<string, string>;
  /** Vectors by video id, for channel-fit and originality checks later in the run. */
  vectors: Map<string, number[]>;
  embeddingModel: string | null;
}

/**
 * Keeps clusters that describe a market topic: at least `minVideos` videos from at least
 * `minChannels` channels (your channel counts). Largest first, capped. Pure.
 */
export function keepMarketClusters(clusters: Cluster[], inputs: TopicInput[], vectors: number[][]): RawTopic[] {
  return clusters
    .filter((c) => c.members.length >= T.minVideos && new Set(c.members.map((i) => inputs[i].channelId)).size >= T.minChannels)
    .sort((a, b) => b.members.length - a.members.length || a.members[0] - b.members[0])
    .slice(0, T.maxTopics)
    .map((c, k) => ({
      id: `t${k + 1}`,
      members: c.members,
      cohesion: Math.round(c.cohesion * 100) / 100,
      centroid: c.centroid,
      representative: [...c.members].sort((a, b) => cosine(vectors[b], c.centroid) - cosine(vectors[a], c.centroid)).slice(0, 8),
    }));
}

const labelSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(2).max(80),
      isContentTopic: z.boolean().optional(),
      problemOriented: z.boolean().optional(),
      audienceProblem: z.string().max(160).nullable().optional(),
    })
  ),
});

/**
 * Names clusters from their representative titles. The model can't add, merge or split
 * clusters: answers for ids we didn't send are ignored, and clusters it marks as not a
 * content topic (sponsor notices, channel admin) are returned in `dropped`.
 */
export async function labelTopics(
  topics: RawTopic[],
  inputs: TopicInput[],
  language: string,
  models: string[]
): Promise<{ labels: Map<string, TopicLabel>; dropped: Set<string> }> {
  const labels = new Map<string, TopicLabel>();
  const dropped = new Set<string>();
  const fallback = (t: RawTopic): TopicLabel => ({
    label: inputs[t.representative[0]].title.slice(0, 70),
    source: 'fallback',
    problemOriented: false,
    audienceProblem: null,
  });
  if (topics.length === 0) return { labels, dropped };

  const answer = await callLLM({
    tag: 'discover:topics',
    models,
    json: true,
    temperature: 0.2,
    maxTokens: 2500,
    timeoutMs: 40_000,
    messages: [
      {
        role: 'system',
        content: `You name topic clusters of YouTube videos. For each cluster you get its id and example titles. Give a specific topic name of 2–6 words (e.g. "Deep-sea creature footage", not "Animals" and not one word). Name the subject only: never include a channel, show or brand name. Write names in ${language}. Set isContentTopic to false only for clusters that are not about a video subject (sponsor notices, channel announcements, livestream schedules). Set problemOriented to true when the titles address a viewer's problem or need; then give that problem in under 15 words as audienceProblem, else null. Do not invent clusters. Reply only with JSON: {"topics": [{"id": "...", "label": "...", "isContentTopic": true, "problemOriented": false, "audienceProblem": null}]}`,
      },
      {
        role: 'user',
        content: JSON.stringify(topics.map((t) => ({ id: t.id, titles: t.representative.map((i) => inputs[i].title.slice(0, 120)) }))),
      },
    ],
  });

  const parsed = answer ? labelSchema.safeParse(parseJsonObject(answer.content)) : null;
  const byId = new Map(parsed?.success ? parsed.data.topics.map((t) => [t.id, t]) : []);
  for (const t of topics) {
    const ai = byId.get(t.id);
    if (!ai) {
      labels.set(t.id, fallback(t));
      continue;
    }
    if (ai.isContentTopic === false) {
      dropped.add(t.id);
      continue;
    }
    labels.set(t.id, {
      label: ai.label.trim(),
      source: 'ai',
      problemOriented: Boolean(ai.problemOriented),
      audienceProblem: ai.problemOriented ? ai.audienceProblem?.trim() || null : null,
    });
  }
  return { labels, dropped };
}

/** Embeds, clusters and names topics. Returns no topics (not an error) if embeddings fail. */
export async function buildTopics(
  inputs: TopicInput[],
  options: { embeddingModels: string[]; textModels: string[]; language: string }
): Promise<TopicBuild> {
  const empty: TopicBuild = { topics: [], labels: new Map(), assignment: new Map(), vectors: new Map(), embeddingModel: null };
  if (inputs.length === 0) return empty;

  const embedded = await embed({
    texts: inputs.map((v) => topicText(v.title, v.channelTitle) || v.title.toLowerCase()),
    models: options.embeddingModels,
    tag: 'discover:topics',
  });
  if (!embedded) return empty;

  const threshold = T.clusterSimilarity[embedded.model] ?? T.clusterSimilarity.default;
  const raw = keepMarketClusters(agglomerate(embedded.vectors, threshold), inputs, embedded.vectors);
  const { labels, dropped } = await labelTopics(raw, inputs, options.language, options.textModels);
  const topics = raw.filter((t) => !dropped.has(t.id));

  const assignment = new Map<string, string>();
  for (const t of topics) for (const i of t.members) assignment.set(inputs[i].id, t.id);
  const vectors = new Map(inputs.map((v, i) => [v.id, embedded.vectors[i]]));
  return { topics, labels, assignment, vectors, embeddingModel: embedded.model };
}
