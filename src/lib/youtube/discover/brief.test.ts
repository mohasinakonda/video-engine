import { describe, expect, it } from 'vitest';
import { briefAsText, toBrief } from './brief';
import type { Opportunity } from './types';

const opportunity: Opportunity = {
  version: 1, id: 'opp_90d_t1', topicId: 't1', topic: 'Deep-sea creature footage', recommendedAngle: 'What lives where sunlight never reaches?',
  angleSource: 'ai', angleRationale: 'Matches your deep-sea Shorts.', whyNow: '3 competitor videos beat their usual views.', audience: 'Curious nature fans',
  problem: null, recommendedFormat: 'explainer', gapTypes: ['coverage'], momentum: 'recent', competition: 'medium', channelFit: 'high',
  productionDifficulty: 'low', scores: { total: 81, channelFit: 90, competitorPerformance: 70, momentum: 90, contentGap: 90, competition: 50, productionFit: 90, phase1: null },
  signalsUsed: 6, confidence: 'medium', confidenceReasons: [], evidence: [],
  competitorSignals: [{ videoId: 'v1', channelId: 'C', title: 'Competitor Title', ratio: 4, views: 400_000, baselineViews: 100_000, sampleSize: 20 }],
  yourVideoIds: [], yourVideos: [], window: '90d', generatedAt: '2026-10-19T00:00:00Z',
};

describe('video brief', () => {
  it('keeps the idea and reasoning but no competitor titles or statistics', () => {
    const brief = toBrief(opportunity, new Date('2026-10-19T00:00:00Z'));
    expect(brief).toMatchObject({ angle: 'What lives where sunlight never reaches?', angleIsAi: true, format: 'explainer', audience: 'Curious nature fans' });
    const serialized = JSON.stringify(brief);
    expect(serialized).not.toContain('Competitor Title');
    expect(serialized).not.toContain('400000');
  });

  it('reads as plain text', () => {
    expect(briefAsText(toBrief(opportunity))).toBe(
      'Video idea: What lives where sunlight never reaches?\nTopic: Deep-sea creature footage\nFormat: Explainer\nFor: Curious nature fans\nWhy: 3 competitor videos beat their usual views. Matches your deep-sea Shorts.'
    );
  });
});
