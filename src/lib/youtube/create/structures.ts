/**
 * Default video structures per format (docs/create-plan.md §3.2). Deterministic starting points
 * the user can rename, reorder, add to or remove from. Never forced on a script.
 */
import type { ContentFormat } from '../discover/formats';

export interface StructureBeat {
  id: string;
  label: string;
  purpose: string;
}

const beat = (id: string, label: string, purpose: string): StructureBeat => ({ id, label, purpose });

const HOOK = beat('hook', 'Hook', 'Show the promise and why it matters, in the first seconds');
const CTA = beat('cta', 'Close', 'Land the payoff and point to what to watch or do next');

export const STRUCTURES: Record<ContentFormat, StructureBeat[]> = {
  comparison: [
    HOOK,
    beat('setup', 'What we compare and how', 'Name the options and the test criteria'),
    beat('round1', 'Round 1', 'First criterion, with a clear winner'),
    beat('round2', 'Round 2', 'Second criterion'),
    beat('round3', 'Round 3', 'Third criterion'),
    beat('verdict', 'Verdict', 'Overall result, with nuance'),
    beat('who', 'Who should pick which', 'Match each option to a viewer'),
    CTA,
  ],
  review: [
    HOOK,
    beat('what', 'What it is', 'Quick context: what, price, who it is for'),
    beat('good', 'What works', 'Strengths, shown not told'),
    beat('bad', 'What doesn’t', 'Honest weaknesses'),
    beat('verdict', 'Verdict', 'Buy, skip, or who it suits'),
    CTA,
  ],
  tutorial: [
    HOOK,
    beat('result', 'The end result', 'Show what the viewer will be able to do'),
    beat('prep', 'What you need', 'Tools, prerequisites'),
    beat('steps', 'Steps', 'Each step, in order'),
    beat('mistakes', 'Common mistakes', 'What goes wrong and how to avoid it'),
    CTA,
  ],
  list: [
    HOOK,
    beat('items', 'The items', 'Each item with why it earns its place'),
    beat('best', 'The standout', 'The best or most surprising item, saved for last'),
    CTA,
  ],
  experiment: [
    HOOK,
    beat('question', 'The question', 'What we want to find out'),
    beat('method', 'The test', 'How it was tested, fairly'),
    beat('results', 'Results', 'What happened'),
    beat('meaning', 'What it means', 'Takeaway for the viewer'),
    CTA,
  ],
  before_after: [
    HOOK,
    beat('before', 'Before', 'The starting problem'),
    beat('process', 'The process', 'What was done'),
    beat('after', 'After', 'The result and what changed'),
    CTA,
  ],
  challenge: [
    HOOK,
    beat('rules', 'The rules', 'The challenge and the stakes'),
    beat('attempt', 'The attempt', 'Progress and setbacks'),
    beat('outcome', 'Outcome', 'Did it work?'),
    CTA,
  ],
  myth_testing: [
    HOOK,
    beat('myth', 'The claim', 'What people believe'),
    beat('test', 'Testing it', 'Evidence or test'),
    beat('truth', 'The truth', 'Busted, confirmed, or it depends'),
    CTA,
  ],
  problem_solution: [
    HOOK,
    beat('problem', 'The problem', 'Make the viewer feel it'),
    beat('why', 'Why it happens', 'The cause'),
    beat('fix', 'The fix', 'Solutions, best first'),
    CTA,
  ],
  case_study: [
    HOOK,
    beat('situation', 'The situation', 'Where it started'),
    beat('actions', 'What was done', 'Key decisions'),
    beat('results', 'Results', 'What changed'),
    beat('lessons', 'Lessons', 'What the viewer can take from it'),
    CTA,
  ],
  reaction: [HOOK, beat('context', 'Context', 'What we react to'), beat('reactions', 'Reactions', 'Moments and commentary'), beat('take', 'Our take', 'Overall view'), CTA],
  documentary: [
    HOOK,
    beat('context', 'Context', 'Set the scene'),
    beat('story', 'The story', 'Events, in a clear order'),
    beat('turn', 'The turning point', 'The surprising or key moment'),
    beat('meaning', 'Why it matters', 'What it tells us today'),
    CTA,
  ],
  compilation: [HOOK, beat('moments', 'Moments', 'The clips or scenes, best spread out'), beat('best', 'Best moment', 'Saved for last'), CTA],
  news: [HOOK, beat('what', 'What happened', 'The news in one sentence'), beat('details', 'Details', 'Key facts'), beat('impact', 'What it means for you', 'Impact on the viewer'), CTA],
  explainer: [
    HOOK,
    beat('question', 'The question', 'What we explain'),
    beat('context', 'Context', 'Only what the viewer needs'),
    beat('part1', 'Part 1', 'First idea'),
    beat('part2', 'Part 2', 'Second idea'),
    beat('part3', 'Part 3', 'Third idea'),
    beat('payoff', 'Payoff', 'The answer, clearly'),
    CTA,
  ],
};

/** Used when no format is chosen yet. */
export const GENERIC_STRUCTURE: StructureBeat[] = [
  HOOK,
  beat('context', 'Context', 'What the viewer needs to know'),
  beat('main', 'Main part', 'The core content'),
  beat('payoff', 'Payoff', 'Deliver the promise'),
  CTA,
];

export const structureFor = (format: ContentFormat | null): StructureBeat[] => (format ? STRUCTURES[format] : GENERIC_STRUCTURE).map((b) => ({ ...b }));
