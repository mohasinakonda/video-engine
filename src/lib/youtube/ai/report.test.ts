import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeDataset } from '../__tests__/fixtures';
import type { DeterministicReport } from '../types';
import { generateReport } from './report';

const callLLM = vi.fn();
vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: (...args: unknown[]) => callLLM(...args),
}));

function deterministic(): DeterministicReport {
  return {
    metrics: [],
    videos: [],
    retentionAnomalies: [],
    titleFeatures: [],
    evidence: [
      { id: 'ev_early_exit', category: 'retention', statement: 'Many viewers left early.', values: {}, sampleSize: 8, confidence: 'medium' },
      { id: 'ev_discovery_strong', category: 'strength', statement: 'Recommendations drive views.', values: {}, sampleSize: 100, confidence: 'high' },
    ],
    findings: [{ category: 'retention', evidenceIds: ['ev_early_exit'], confidence: 'medium', isHypothesis: false }],
    strengths: ['ev_discovery_strong'],
    limitations: [],
  };
}

const aiAnswer = (overrides: object = {}) =>
  JSON.stringify({
    headline: 'People stop watching in the first 30 seconds',
    summary: 'Viewers leave early, but YouTube recommends the channel well.',
    primaryBottleneck: { category: 'retention', title: 'Viewers leave early', explanation: 'Many viewers left in the first 30 seconds.', evidenceIds: ['ev_early_exit', 'ev_made_up'] },
    secondaryBottlenecks: [{ category: 'packaging', title: 'Thumbnails', explanation: 'Invented packaging issue.', evidenceIds: ['ev_made_up'] }],
    strengths: [{ title: 'Recommendations', explanation: 'Most views come from recommendations.', evidenceIds: ['ev_discovery_strong'] }],
    actions: [{ priority: 1, title: 'Tighten intros', why: 'Viewers leave early.', how: 'Start with the payoff.', evidenceIds: ['ev_early_exit'], effort: 'low', expectedImpact: 'potentially_high' }],
    ...overrides,
  });

afterEach(() => callLLM.mockReset());

describe('AI report', () => {
  it('removes evidence ids and bottlenecks the engine did not produce', async () => {
    callLLM.mockResolvedValue({ content: aiAnswer(), model: 'm' });
    const report = await generateReport(makeDataset(), deterministic(), ['m']);
    expect(report.source).toBe('ai');
    expect(report.primaryBottleneck?.evidenceIds).toEqual(['ev_early_exit']);
    expect(report.secondaryBottlenecks).toHaveLength(0); // packaging was never found
  });

  it('takes confidence from the engine, not the model', async () => {
    callLLM.mockResolvedValue({ content: aiAnswer(), model: 'm' });
    const report = await generateReport(makeDataset(), deterministic(), ['m']);
    expect(report.primaryBottleneck?.confidence).toBe('medium');
    expect(report.primaryBottleneck?.isHypothesis).toBe(false);
  });

  it('falls back to measured findings when the AI fails', async () => {
    callLLM.mockResolvedValue(null);
    const report = await generateReport(makeDataset(), deterministic(), ['m']);
    expect(report.source).toBe('fallback');
    expect(report.primaryBottleneck?.category).toBe('retention');
    expect(report.actions[0].evidenceIds).toEqual(['ev_early_exit']);
  });

  it('falls back when the AI cites none of the real evidence', async () => {
    callLLM.mockResolvedValue({
      content: aiAnswer({
        primaryBottleneck: { category: 'retention', title: 'X', explanation: 'Made up explanation here.', evidenceIds: ['ev_made_up'] },
      }),
      model: 'm',
    });
    expect((await generateReport(makeDataset(), deterministic(), ['m'])).source).toBe('fallback');
  });

  it('sends a compact payload without tokens or raw responses', async () => {
    callLLM.mockResolvedValue(null);
    await generateReport(makeDataset(), deterministic(), ['m']);
    const sent = JSON.stringify(callLLM.mock.calls[0][0].messages);
    expect(sent).not.toMatch(/access_token|refresh_token|Bearer/);
    expect(sent.length).toBeLessThan(20_000);
  });

  it('never lets a hypothesis headline claim a cause', async () => {
    const report = deterministic();
    report.findings[0].isHypothesis = true;
    callLLM.mockResolvedValue({ content: aiAnswer({ headline: 'Growth stalled because you stopped posting' }), model: 'm' });
    const result = await generateReport(makeDataset(), report, ['m']);
    expect(result.headline).toBe('Viewers leave early');
  });
});
