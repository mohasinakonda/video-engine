import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: vi.fn(),
}));
import { callLLM } from '@/lib/llm-providers';
import { agglomerate } from './clustering';
import { ruleFormats, titleMechanisms } from './formats';
import { classifyWithAI } from './formats-ai';
import { summarizePatterns, type TaggedVideo } from './market-patterns';
import { topicText } from './similarity';
import { keepMarketClusters, labelTopics, type TopicInput } from './topics';

afterEach(() => vi.mocked(callLLM).mockReset());

describe('formats from titles', () => {
  it('recognises English and Bangla patterns', () => {
    expect(ruleFormats('iPhone 17 vs Pixel 10 camera test').primary).toBe('comparison');
    expect(ruleFormats('How to clean car seats at home').primary).toBe('tutorial');
    expect(ruleFormats('গাড়ির সিট কিভাবে পরিষ্কার করবেন').primary).toBe('tutorial');
    expect(ruleFormats('Top 10 deadliest sea animals').primary).toBe('list');
    expect(ruleFormats('I tested 5 portable vacuums').primary).toBe('experiment');
    expect(ruleFormats('4 Hours Of Remarkable Wildlife | 4K').primary).toBe('compilation');
    expect(ruleFormats('Why the Mariana Trench still terrifies scientists').primary).toBe('explainer');
    expect(ruleFormats('স্যামসাং বনাম শাওমি').primary).toBe('comparison');
  });

  it('keeps a secondary format and leaves unclear titles unclassified', () => {
    expect(ruleFormats('How to fix a slow laptop: 7 mistakes')).toMatchObject({ primary: 'tutorial', secondary: 'list' });
    expect(ruleFormats('Otter release on film')).toMatchObject({ primary: null, source: null });
  });

  it('marks question-style explainers as medium confidence', () => {
    expect(ruleFormats('Why do cats purr?').confidence).toBe('medium');
    expect(ruleFormats('A vs B').confidence).toBe('high');
  });
});

describe('title mechanisms', () => {
  it('flags packaging mechanisms', () => {
    expect(titleMechanisms('Why The Ocean’s Deadliest Predator Refuses To Kill Us — The Truth Is Strange')).toEqual(
      expect.arrayContaining(['why', 'strong_claim', 'contrarian', 'curiosity'])
    );
    expect(titleMechanisms('Before you buy a robot vacuum, watch this?')).toEqual(expect.arrayContaining(['before_you_buy', 'question']));
    expect(titleMechanisms('Beavers cutting wood')).toEqual([]);
  });
});

describe('AI format fallback', () => {
  it('keeps valid items, drops bad ones individually, and caps confidence', async () => {
    vi.mocked(callLLM).mockResolvedValue({
      model: 'm/x',
      content: JSON.stringify({
        formats: [
          { n: 0, primary: 'documentary', confidence: 'high' },
          { n: 1, primary: 'vlog', confidence: 'high' },
          { n: 2, primary: null },
          { n: 9, primary: 'review' },
        ],
      }),
    });
    const tags = await classifyWithAI(['a', 'b', 'c'], ['m/x']);
    expect(Array.from(tags.keys())).toEqual([0]);
    expect(tags.get(0)).toMatchObject({ primary: 'documentary', confidence: 'medium', source: 'ai' });
  });

  it('returns nothing when the model fails', async () => {
    vi.mocked(callLLM).mockResolvedValue(null);
    expect((await classifyWithAI(['a'], ['m/x'])).size).toBe(0);
  });
});

describe('topic text', () => {
  it('drops series and channel suffixes', () => {
    expect(topicText('Grizzly Bears Enjoy A Back Scratch! | 20 Years of Planet Earth II | BBC Earth', 'BBC Earth')).toBe('grizzly bears enjoy a back scratch!');
    expect(topicText('Otters | Planet Earth', 'BBC Earth')).toBe('otters planet earth');
    expect(topicText('Monterey Bay Aquarium otter cam', 'Monterey Bay Aquarium')).toBe('otter cam');
  });
});

describe('clustering', () => {
  // Three tight groups on different axes plus one loner.
  const v = (x: number, y: number, z: number) => [x, y, z];
  const vectors = [v(1, 0.05, 0), v(1, 0, 0.05), v(0.95, 0.05, 0.05), v(0, 1, 0.05), v(0.05, 1, 0), v(0, 0.05, 1), v(0.6, 0.6, 0.6)];

  it('groups similar items, keeps unrelated ones apart, and is deterministic', () => {
    const clusters = agglomerate(vectors, 0.9);
    const groups = clusters.map((c) => c.members).sort((a, b) => a[0] - b[0]);
    expect(groups).toEqual([[0, 1, 2], [3, 4], [5], [6]]);
    expect(agglomerate(vectors, 0.9).map((c) => c.members)).toEqual(clusters.map((c) => c.members));
  });

  it('handles empty input and a single item', () => {
    expect(agglomerate([], 0.5)).toEqual([]);
    expect(agglomerate([v(1, 0, 0)], 0.5)).toHaveLength(1);
  });

  it('keeps only clusters with enough videos from at least 2 channels', () => {
    const inputs: TopicInput[] = vectors.map((_, i) => ({ id: `v${i}`, channelId: i === 0 ? 'A' : i < 3 ? 'B' : 'A', channelTitle: '', title: `t${i}`, isYours: i === 0 }));
    const kept = keepMarketClusters(agglomerate(vectors, 0.9), inputs, vectors);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: 't1', members: [0, 1, 2] });
  });
});

describe('topic labels', () => {
  const inputs: TopicInput[] = ['Rare deep sea fish', 'Barreleye fish footage'].map((title, i) => ({ id: `v${i}`, channelId: 'A', channelTitle: 'A', title, isYours: false }));
  const topics = [{ id: 't1', members: [0, 1], cohesion: 0.9, centroid: [], representative: [0, 1] }, { id: 't2', members: [1], cohesion: 1, centroid: [], representative: [1] }];

  it('ignores invented clusters, drops non-content topics and falls back when unnamed', async () => {
    vi.mocked(callLLM).mockResolvedValue({
      model: 'm/x',
      content: JSON.stringify({
        topics: [
          { id: 't1', label: 'Deep-sea creature footage', isContentTopic: true, problemOriented: false },
          { id: 't9', label: 'Invented' },
        ],
      }),
    });
    const { labels } = await labelTopics(topics, inputs, 'English', ['m/x']);
    expect(labels.get('t1')).toMatchObject({ label: 'Deep-sea creature footage', source: 'ai' });
    expect(labels.get('t2')).toMatchObject({ label: 'Barreleye fish footage', source: 'fallback' });
    expect(labels.has('t9')).toBe(false);

    vi.mocked(callLLM).mockResolvedValue({ model: 'm/x', content: JSON.stringify({ topics: [{ id: 't1', label: 'Sponsor notices', isContentTopic: false }] }) });
    expect((await labelTopics(topics, inputs, 'English', ['m/x'])).dropped.has('t1')).toBe(true);
  });

  it('falls back for every cluster when the model fails', async () => {
    vi.mocked(callLLM).mockResolvedValue(null);
    const { labels } = await labelTopics(topics, inputs, 'English', ['m/x']);
    expect(labels.get('t1')?.source).toBe('fallback');
  });
});

describe('market patterns', () => {
  const tag = (id: string, title: string, primary: TaggedVideo['format']['primary'], isYours = false): TaggedVideo => ({
    id,
    channelId: isYours ? 'Y' : 'C',
    channelTitle: '',
    isYours,
    title,
    publishedAt: '2026-10-01T00:00:00Z',
    durationSec: 600,
    views: 1,
    likes: null,
    comments: null,
    thumbnailUrl: null,
    format: { primary, secondary: null, confidence: primary ? 'high' : null, source: primary ? 'rule' : null },
  });

  it('counts formats and mechanism shares on the same population', () => {
    const eligible = [tag('a', 'A vs B', 'comparison'), tag('b', 'C vs D', 'comparison'), tag('c', 'Why X?', 'explainer'), tag('d', 'Otters', null)];
    const yours = [tag('y', 'Why Y', 'explainer', true)];
    const p = summarizePatterns(eligible, new Set(['a', 'b']), yours);
    expect(p.formats.find((f) => f.format === 'comparison')).toEqual({ format: 'comparison', competitorVideos: 2, competitorOutliers: 2, yourVideos: 0 });
    expect(p.mechanisms.find((m) => m.mechanism === 'comparison')).toMatchObject({ outlierShare: 1, competitorShare: 0.5, yourShare: 0 });
    expect(p).toMatchObject({ competitorVideos: 4, outliers: 2, yourVideos: 1, unclassified: 1 });
  });
});
