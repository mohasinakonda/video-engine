import { describe, expect, it } from 'vitest';
import { canTransition, staleAfter, statusAfterSaving } from './project-state';
import { opportunityInputSchema, toThesis } from './thesis';

describe('project state machine', () => {
  it('allows the main path in order and refuses skipping ahead', () => {
    expect(canTransition('DRAFT', 'BRIEF_READY')).toBe(true);
    expect(canTransition('BRIEF_READY', 'SCRIPT_READY')).toBe(true);
    expect(canTransition('SCRIPT_READY', 'PACKAGED')).toBe(true);

    expect(canTransition('DRAFT', 'SCRIPT_READY')).toBe(false);
    expect(canTransition('BRIEF_READY', 'PACKAGED')).toBe(false);
    expect(canTransition('PACKAGED', 'PACKAGED')).toBe(false);
  });

  it('allows going back to edit an earlier step, but not to an empty draft', () => {
    expect(canTransition('PACKAGED', 'BRIEF_READY')).toBe(true);
    expect(canTransition('PACKAGED', 'SCRIPT_READY')).toBe(true);
    expect(canTransition('BRIEF_READY', 'DRAFT')).toBe(false);
  });

  it('archives from anywhere and restores only to where it was', () => {
    expect(canTransition('PACKAGED', 'ARCHIVED')).toBe(true);
    expect(canTransition('ARCHIVED', 'ARCHIVED')).toBe(false);
    expect(canTransition('ARCHIVED', 'SCRIPT_READY', 'SCRIPT_READY')).toBe(true);
    expect(canTransition('ARCHIVED', 'PACKAGED', 'SCRIPT_READY')).toBe(false);
    expect(canTransition('ARCHIVED', 'PACKAGED', null)).toBe(false);
  });

  it('decides the status after saving a step, and what becomes stale', () => {
    expect(statusAfterSaving('DRAFT', 'brief')).toBe('BRIEF_READY');
    expect(statusAfterSaving('DRAFT', 'script')).toBeNull();
    expect(statusAfterSaving('BRIEF_READY', 'script')).toBe('SCRIPT_READY');
    expect(statusAfterSaving('PACKAGED', 'brief')).toBe('BRIEF_READY');
    expect(statusAfterSaving('PACKAGED', 'packaging')).toBe('PACKAGED');
    expect(statusAfterSaving('ARCHIVED', 'brief')).toBeNull();
    expect(staleAfter('PACKAGED', 'BRIEF_READY')).toEqual(['script', 'packaging']);
    expect(staleAfter('SCRIPT_READY', 'BRIEF_READY')).toEqual(['script']);
  });
});

describe('thesis', () => {
  const opportunity = {
    version: 1,
    id: 'opp_90d_t1',
    topicId: 't1',
    topic: 'Deep-sea creature footage',
    recommendedAngle: 'What lives where sunlight never reaches?',
    recommendedFormat: 'explainer',
    gapTypes: ['coverage'],
    momentum: 'recent',
    competition: 'medium',
    channelFit: 'high',
    productionDifficulty: 'low',
    confidence: 'medium',
    scores: { total: 81, channelFit: 90, competitorPerformance: 70, momentum: 90, contentGap: 90, competition: 50, productionFit: 90, phase1: null },
    signalsUsed: 6,
    window: '90d',
    generatedAt: '2026-10-19T00:00:00.000Z',
    // Competitor data the browser holds; it must not be stored.
    evidence: [{ id: 'e1', statement: '3 competitor videos beat their usual views (median 4.0×).' }],
    competitorSignals: [{ videoId: 'v1', title: 'COMPETITOR TITLE', views: 400000 }],
  };

  it('keeps scores and labels, and drops competitor titles, views and evidence text', () => {
    const thesis = toThesis(opportunityInputSchema.parse(opportunity));
    expect(thesis).toMatchObject({ opportunityId: 'opp_90d_t1', topic: 'Deep-sea creature footage', confidence: 'medium', researchedAt: '2026-10-19T00:00:00.000Z' });
    const stored = JSON.stringify(thesis);
    expect(stored).not.toContain('COMPETITOR TITLE');
    expect(stored).not.toContain('400000');
    expect(stored).not.toContain('median 4.0');
  });

  it('rejects malformed opportunities', () => {
    expect(opportunityInputSchema.safeParse({ ...opportunity, confidence: 'certain' }).success).toBe(false);
    expect(opportunityInputSchema.safeParse({ ...opportunity, scores: { ...opportunity.scores, total: 150 } }).success).toBe(false);
    expect(opportunityInputSchema.safeParse({ ...opportunity, recommendedFormat: 'vlog' }).success).toBe(false);
  });
});

describe('library next steps', () => {
  it('points every live status at its page, and none for archived', async () => {
    const { nextStepOf, LIBRARY_TABS } = await import('@/components/create/next-step');
    const { PROJECT_STATUSES } = await import('./types');
    expect(nextStepOf({ id: 'p', status: 'DRAFT' })?.href).toBe('/create/p');
    expect(nextStepOf({ id: 'p', status: 'SCRIPT_READY' })?.href).toBe('/create/p/package');
    expect(nextStepOf({ id: 'p', status: 'PACKAGED' })?.href).toBe('/create/p/package');
    expect(nextStepOf({ id: 'p', status: 'ARCHIVED' })).toBeNull();
    // Every status appears in exactly one library tab.
    const tabbed = LIBRARY_TABS.flatMap((t) => t.statuses as readonly string[]);
    expect([...tabbed].sort()).toEqual([...PROJECT_STATUSES].sort());
  });
});
