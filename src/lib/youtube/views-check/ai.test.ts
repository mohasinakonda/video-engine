import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm-providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/llm-providers')>();
  return { ...actual, callLLM: vi.fn() };
});

import { callLLM } from '@/lib/llm-providers';
import { numbersIn, wordViewsReport } from './ai';
import type { ViewsCheckReport } from './types';

const llm = vi.mocked(callLLM);
afterEach(() => llm.mockReset());

const report: ViewsCheckReport = {
  verdict: { cause: 'quick_stop', headline: 'Your Shorts get a first burst, then stop (3 of 4).', firstStep: 'Test one change per Short.', basedOn: 4 },
  videos: [
    {
      videoId: 'a',
      title: 'Tire shine',
      format: 'short',
      publishedAt: '2026-10-20T00:00:00Z',
      reportedDays: 12,
      lifetimeViews: 900,
      durationSec: 30,
      avgViewPct: 52,
      cause: 'quick_stop',
      reason: 'It got a first burst, then stopped.',
      evidence: ['90% of its views came in the first 2 days'],
      fix: 'Test one change per Short.',
    },
  ],
  shorts: [],
  signals: [],
  studioChecks: [],
  plan: ['Test one change per Short.', 'Reply to every comment.'],
  limitations: [],
  summary: { judgedVideos: 4, tooNew: 0, byCause: { quick_stop: 3 }, avgShortViews: 900, avgLongViews: null },
};

const reply = (body: object) => llm.mockResolvedValue({ content: JSON.stringify(body), model: 'm' });

describe('numbersIn', () => {
  it('reads ASCII and Bangla digits', () => {
    expect(numbersIn('90% in 2 days, ৩ of ৪')).toEqual(['90', '2', '3', '4']);
  });
});

describe('wordViewsReport', () => {
  it('uses the AI wording when it keeps to the facts', async () => {
    reply({ headline: 'Your Shorts stop after 2 days.', explanation: 'They get 90% of views early, then other Shorts win.', plan: ['Change one thing per Short.', 'Answer every comment.'] });
    const wording = await wordViewsReport(report, 'English', ['m']);
    expect(wording.source).toBe('ai');
    expect(wording.plan).toHaveLength(2);
  });

  it('falls back to the rules when the AI adds a number', async () => {
    reply({ headline: 'Your Shorts stop after 2 hours.', explanation: 'Only 15% of viewers stay.', plan: ['Change one thing per Short.', 'Answer every comment.'] });
    expect((await wordViewsReport(report, 'English', ['m'])).source).toBe('rules');
  });

  it('falls back when the AI drops a plan step or fails', async () => {
    reply({ headline: 'Your Shorts stop early.', explanation: 'Other Shorts win the next audience.', plan: ['Change one thing per Short.'] });
    expect((await wordViewsReport(report, 'English', ['m'])).source).toBe('rules');
    llm.mockResolvedValue(null);
    const wording = await wordViewsReport(report, 'English', ['m']);
    expect(wording).toMatchObject({ source: 'rules', headline: report.verdict.headline, plan: report.plan });
  });
});
