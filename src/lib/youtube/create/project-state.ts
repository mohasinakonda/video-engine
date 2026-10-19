/**
 * The project state machine (docs/create-plan.md §8). Pure. Every status change on the
 * server goes through `canTransition`; anything else is refused with 409.
 */
import type { ProjectStatus } from './types';

/** The main path, in order. */
export const FLOW: ProjectStatus[] = ['DRAFT', 'BRIEF_READY', 'SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED'];

const rank = (s: ProjectStatus) => FLOW.indexOf(s);

const FORWARD: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['BRIEF_READY'],
  BRIEF_READY: ['SCRIPT_READY'],
  SCRIPT_READY: ['PACKAGED'],
  // A video can be linked straight from PACKAGED; IN_PRODUCTION is optional.
  PACKAGED: ['IN_PRODUCTION', 'PUBLISHED'],
  IN_PRODUCTION: ['PUBLISHED'],
  PUBLISHED: ['ANALYZING'],
  ANALYZING: ['LEARNED'],
  LEARNED: [],
  ARCHIVED: [],
};

/** Once a video is out, its brief, script and packaging are the record of what was made. */
export const isLocked = (status: ProjectStatus) => rank(status) >= rank('PUBLISHED');

export function canTransition(from: ProjectStatus, to: ProjectStatus, archivedFrom?: ProjectStatus | null): boolean {
  if (from === to) return false;
  if (to === 'ARCHIVED') return from !== 'ARCHIVED';
  if (from === 'ARCHIVED') return archivedFrom === to;
  if (FORWARD[from].includes(to)) return true;
  // Going back to edit an earlier step is allowed until the video is published…
  if (!isLocked(from) && rank(to) >= rank('BRIEF_READY') && rank(to) < rank(from)) return true;
  // …and undoing a video link returns to where the project was before.
  if (from === 'PUBLISHED' && (to === 'PACKAGED' || to === 'IN_PRODUCTION')) return true;
  return false;
}

export type EditableField = 'brief' | 'script' | 'packaging';

/** The step an edited field belongs to. */
const STEP_OF: Record<EditableField, ProjectStatus> = { brief: 'BRIEF_READY', script: 'SCRIPT_READY', packaging: 'PACKAGED' };

/**
 * Status after saving a field: completing the next step moves forward; editing an earlier
 * step moves back to it (later steps then need review). Null when the edit isn't allowed.
 */
export function statusAfterSaving(current: ProjectStatus, field: EditableField): ProjectStatus | null {
  if (isLocked(current) || current === 'ARCHIVED') return null;
  const step = STEP_OF[field];
  if (rank(step) > rank(current) + 1) return null; // can't skip ahead (e.g. a script before a brief)
  return step;
}

/** Steps whose content is now out of date after going back to `status`. */
export function staleAfter(previous: ProjectStatus, status: ProjectStatus): EditableField[] {
  return (Object.keys(STEP_OF) as EditableField[]).filter((f) => rank(STEP_OF[f]) > rank(status) && rank(STEP_OF[f]) <= rank(previous));
}
