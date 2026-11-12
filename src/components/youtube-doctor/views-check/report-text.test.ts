import { describe, expect, it } from 'vitest';
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import { reportText } from './report-text';

const result = {
  version: 20,
  channel: { id: 'c', title: 'My Channel', thumbnail: null, url: '', subscriberCount: 1200, videoCount: 40 },
  period: { days: 90 },
  wording: { headline: 'Your hook loses most viewers.', explanation: 'They swipe away fast.', plan: ['Show the best part first.'], source: 'rules' },
  report: {
    verdict: { cause: 'weak_hook', headline: '', firstStep: '', basedOn: 2 },
    health: {
      score: 48,
      band: 'weak',
      provisional: true,
      shorts: 5,
      p: null,
      t: null,
      parts: [{ id: 'viewed', name: 'Hook', weight: 1, score: 40, value: 0.3, text: '70 of every 100 swipe away' }],
      trend: null,
      headline: 'Hook is weak.',
      detail: '',
    },
    distribution: { score: null, band: null, provisional: true, shorts: 2, parts: [], headline: 'Not enough Shorts.', detail: '' },
    account: { score: 100, band: 'excellent', checked: 2, issues: [], headline: 'Your channel is fine.', detail: 'We checked 2 videos.' },
    outlook: {
      id: 'not_growing',
      title: 'Your views won’t grow until the hook improves',
      detail: 'd',
      nextStep: 'Fix the hook.',
      content: { state: 'weak', medianSwipeAway: 0.7, medianViewPct: 55, shorts: 5 },
      reach: { state: 'flat', by: 'views', change: 1.1, recent: null, previous: null },
      check: null,
    },
    stopPoints: [{ gate: 'stopped', count: 2 }],
    topics: [],
    videos: [
      {
        videoId: 'a',
        title: 'Good one',
        format: 'short',
        publishedAt: '',
        reportedDays: 5,
        lifetimeViews: 900,
        durationSec: 20,
        avgViewPct: 80,
        countryBlock: false,
        cause: 'ok',
        reason: 'No problem found.',
        evidence: [],
        fix: '',
      },
      {
        videoId: 'b',
        title: 'Bad one',
        format: 'short',
        publishedAt: '',
        reportedDays: 5,
        lifetimeViews: 50,
        durationSec: 20,
        avgViewPct: 30,
        countryBlock: false,
        cause: 'weak_hook',
        reason: 'The hook lost them.',
        evidence: ['70% swiped'],
        fix: 'Start with the best part.',
      },
    ],
    limitations: ['Studio-only numbers.'],
  },
} as unknown as ViewsCheckResult;

describe('reportText', () => {
  it('asks the AI for Bangla and includes every section', () => {
    const text = reportText(result, '2026-11-12T10:00:00Z');
    expect(text).toMatch(/simple Bangla/);
    expect(text).toContain('Channel: My Channel');
    expect(text).toContain('1. Show the best part first.');
    expect(text).toContain('Video quality (do viewers stay and watch?): 48/100 (Needs work) – early read');
    expect(text).toContain('YouTube reach (is YouTube showing my Shorts? shadowban check): no score yet');
    expect(text).toContain('- 2 Shorts: most people swiped away in the first 2 seconds');
    // Problem videos come first.
    expect(text.indexOf('"Bad one"')).toBeLessThan(text.indexOf('"Good one"'));
    expect(text).toContain('Fix: Start with the best part.');
  });
});
