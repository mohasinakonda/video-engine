import { FORMAT_LABELS, type ContentFormat } from './formats';
import type { Opportunity } from './types';

/**
 * What the video-creation flow (Phase 3) will start from. Only the idea and the reasoning:
 * no competitor titles or statistics, which can't be kept beyond 30 days under YouTube's
 * API policy (docs/discover-plan.md §12).
 */
export interface VideoBrief {
  version: 1;
  opportunityId: string;
  topic: string;
  angle: string;
  angleIsAi: boolean;
  format: ContentFormat | null;
  audience: string | null;
  viewerProblem: string | null;
  whyThisVideo: string[];
  createdAt: string;
}

export function toBrief(o: Opportunity, now = new Date()): VideoBrief {
  return {
    version: 1,
    opportunityId: o.id,
    topic: o.topic,
    angle: o.recommendedAngle ?? o.topic,
    angleIsAi: o.angleSource === 'ai',
    format: o.recommendedFormat,
    audience: o.audience,
    viewerProblem: o.problem,
    whyThisVideo: [o.whyNow, o.angleRationale].filter((x): x is string => Boolean(x)),
    createdAt: now.toISOString(),
  };
}

/** Plain text for copying into notes or a script tool. */
export function briefAsText(b: VideoBrief): string {
  return [
    `Video idea: ${b.angle}`,
    `Topic: ${b.topic}`,
    b.format && `Format: ${FORMAT_LABELS[b.format]}`,
    b.audience && `For: ${b.audience}`,
    b.viewerProblem && `Viewer need: ${b.viewerProblem}`,
    b.whyThisVideo.length > 0 && `Why: ${b.whyThisVideo.join(' ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}
