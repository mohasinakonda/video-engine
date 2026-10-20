import type { ProjectStatus, VideoProject } from './types';

/** The one thing to do next on a project, and where. */
export const NEXT_STEP: Record<Exclude<ProjectStatus, 'ARCHIVED'>, { label: string; path: string }> = {
  DRAFT: { label: 'Write the brief', path: '' },
  BRIEF_READY: { label: 'Write the script', path: '/script' },
  SCRIPT_READY: { label: 'Title & thumbnail', path: '/package' },
  PACKAGED: { label: 'Link the published video', path: '/publish' },
  IN_PRODUCTION: { label: 'Link the published video', path: '/publish' },
  PUBLISHED: { label: 'Check performance', path: '/measure' },
  ANALYZING: { label: 'Check performance', path: '/measure' },
  LEARNED: { label: 'See results', path: '/measure' },
};

export function nextStepOf(project: Pick<VideoProject, 'id' | 'status'>): { label: string; href: string } | null {
  if (project.status === 'ARCHIVED') return null;
  const step = NEXT_STEP[project.status];
  return { label: step.label, href: `/create/${project.id}${step.path}` };
}

export const LIBRARY_TABS = [
  { id: 'progress', label: 'In progress', statuses: ['DRAFT', 'BRIEF_READY', 'SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION'] },
  { id: 'published', label: 'Published', statuses: ['PUBLISHED', 'ANALYZING'] },
  { id: 'learned', label: 'Learned', statuses: ['LEARNED'] },
  { id: 'archived', label: 'Archived', statuses: ['ARCHIVED'] },
] as const satisfies readonly { id: string; label: string; statuses: readonly ProjectStatus[] }[];

export type LibraryTab = (typeof LIBRARY_TABS)[number]['id'];
