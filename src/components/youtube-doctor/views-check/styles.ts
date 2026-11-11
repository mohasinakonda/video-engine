/**
 * Labels and colours for the views check report.
 * Palette classes only: the app's light theme remaps each shade (950 → pale tint, 200 → dark ink),
 * so the same classes read well in both themes. Fixed hex colours are used only for chart fills.
 */
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Level } from '@/lib/youtube/views-check/levels';
import type { GateId, ShortTest, TestRound, ViewsCause } from '@/lib/youtube/views-check/types';

export const CAUSE: Record<ViewsCause, { label: string; color: string; pill: string }> = {
  blocked: { label: 'Can’t be watched', color: '#f43f5e', pill: 'bg-rose-950 text-rose-200' },
  not_shown: { label: 'YouTube didn’t show it', color: '#fb7185', pill: 'bg-rose-950 text-rose-200' },
  not_in_feed: { label: 'Kept out of the feed', color: '#a78bfa', pill: 'bg-violet-950 text-violet-200' },
  not_clicked: { label: 'Seen, not tapped', color: '#38bdf8', pill: 'bg-sky-950 text-sky-200' },
  new_topic: { label: 'New topic, no viewers yet', color: '#38bdf8', pill: 'bg-sky-950 text-sky-200' },
  weak_hook: { label: 'Swiped away at the start', color: '#f97316', pill: 'bg-orange-950 text-orange-200' },
  left_early: { label: 'Viewers leave before the end', color: '#fb923c', pill: 'bg-amber-950 text-amber-200' },
  quick_stop: { label: 'Views stuck after day 1–2', color: '#fbbf24', pill: 'bg-amber-950 text-amber-200' },
  unknown: { label: 'Not enough data yet', color: '#52525b', pill: 'bg-zinc-800 text-zinc-300' },
  too_new: { label: 'Too new: check in 3 days', color: '#71717a', pill: 'bg-zinc-800 text-zinc-300' },
  ok: { label: 'No problem found', color: '#34d399', pill: 'bg-emerald-950 text-emerald-200' },
};

/** Worst first. */
export const CAUSE_ORDER: ViewsCause[] = ['blocked', 'not_shown', 'not_in_feed', 'not_clicked', 'new_topic', 'weak_hook', 'left_early', 'quick_stop', 'unknown', 'too_new', 'ok'];
export const PROBLEMS = new Set<ViewsCause>(['blocked', 'not_shown', 'not_in_feed', 'not_clicked', 'new_topic', 'weak_hook', 'left_early', 'quick_stop']);

export const LEVEL_STYLE: Record<Level, { box: string; label: string; hint: string; pill: string; text: string; Icon: typeof AlertCircle }> = {
  critical: { box: 'bg-rose-950/70 border-rose-700', label: 'text-rose-200', hint: 'text-rose-300', pill: 'bg-rose-800 text-rose-50', text: 'text-rose-400', Icon: AlertTriangle },
  error: { box: 'bg-orange-950/70 border-orange-700', label: 'text-orange-200', hint: 'text-orange-300', pill: 'bg-orange-800 text-orange-50', text: 'text-orange-400', Icon: AlertCircle },
  warning: { box: 'bg-amber-950/70 border-amber-700', label: 'text-amber-200', hint: 'text-amber-300', pill: 'bg-amber-800 text-amber-50', text: 'text-amber-400', Icon: AlertCircle },
  ok: { box: 'bg-emerald-950/70 border-emerald-700', label: 'text-emerald-200', hint: 'text-emerald-300', pill: 'bg-emerald-800 text-emerald-50', text: 'text-zinc-200', Icon: CheckCircle2 },
};

export const RESULT: Record<ShortTest['result'], { label: string; chip: string; box: string }> = {
  passed: { label: 'Better than your usual', chip: 'bg-emerald-950 text-emerald-200', box: 'border-emerald-800 bg-emerald-950/40' },
  close: { label: 'About your usual', chip: 'bg-amber-950 text-amber-200', box: 'border-amber-700 bg-amber-950/60' },
  failed: { label: 'Worse than your usual', chip: 'bg-rose-950 text-rose-200', box: 'border-rose-700 bg-rose-950/60' },
};

/** Bar colours for days 1–3 in the views-per-day chart. */
export const ROUND_COLOR: Record<TestRound['no'], string> = { 1: '#34d399', 2: '#fbbf24', 3: '#fb923c' };
export const MUTED_BAR = '#52525b';

export const SEVERITY: Record<'high' | 'medium' | 'low', { label: string; pill: string }> = {
  high: { label: 'High', pill: 'bg-rose-950 text-rose-200' },
  medium: { label: 'Medium', pill: 'bg-amber-950 text-amber-200' },
  low: { label: 'Low', pill: 'bg-zinc-800 text-zinc-300' },
};

export const GATE_LABEL: Record<GateId, string> = { shown: 'Shown', stopped: 'Didn’t swipe away', stayed: 'Watched', reacted: 'Liked or shared' };

export const STATE_TONE = { pass: 'text-emerald-300', fail: 'text-rose-300', unknown: 'text-zinc-500' } as const;
export const STATE_BOX = { pass: 'border-emerald-800 bg-emerald-950/40', fail: 'border-rose-700 bg-rose-950/60', unknown: 'border-bg-border bg-bg-surface' } as const;
export const STATE_MARK = { pass: '✓', fail: '✗', unknown: '–' } as const;

/** What each stopping step means for the creator, and what to do about it. */
export const STOP_LINE: Record<GateId | 'none', { what: string; todo: string; tone: string }> = {
  shown: { what: 'YouTube showed them to almost no one', todo: 'Check Restrictions and Copyright in Studio for these Shorts.', tone: 'border-rose-700 bg-rose-950/60' },
  stopped: { what: 'most people swiped away in the first 2 seconds', todo: 'Fix the opening: show the most interesting moment first.', tone: 'border-rose-700 bg-rose-950/60' },
  stayed: { what: 'people started watching but left before the end', todo: 'Make them shorter, or move the payoff earlier.', tone: 'border-amber-700 bg-amber-950/60' },
  reacted: { what: 'people watched, but almost nobody liked, commented or shared', todo: 'Give viewers a reason to react: a question, a surprise, a strong ending.', tone: 'border-amber-700 bg-amber-950/60' },
  none: { what: 'did well on everything we can measure', todo: 'Make more like these.', tone: 'border-emerald-800 bg-emerald-950/40' },
};
