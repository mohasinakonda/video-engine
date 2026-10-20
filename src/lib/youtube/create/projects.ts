import { z } from 'zod';
import { getServiceClient } from '../db';
import { canTransition } from './project-state';
import type { ProjectError, ProjectStatus, Thesis, VideoProject } from './types';

/**
 * Video projects. Users can only read their rows through RLS; all writes come through here
 * with the service client, so the state machine can't be bypassed from the browser. Every
 * query filters by the session user's id.
 */

const TABLE = 'video_projects';
const COLUMNS = 'id, origin, status, archived_from, last_error, title, thesis, brief, script, packaging, created_at, updated_at';

export const titleSchema = z.string().trim().min(1, 'Give the project a title').max(200);

export class ProjectLimitError extends Error {
  constructor(public max: number) {
    super(`You can keep up to ${max} projects. Archive or delete one first.`);
  }
}

/** The status changed under us (another tab, or an invalid move). */
export class TransitionError extends Error {
  constructor(public from: ProjectStatus, public to: ProjectStatus) {
    super(`This project can’t go from ${from} to ${to}.`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProject(r: any): VideoProject {
  return {
    id: r.id,
    origin: r.origin,
    status: r.status,
    archivedFrom: r.archived_from,
    lastError: r.last_error,
    title: r.title,
    thesis: r.thesis,
    brief: r.brief,
    script: r.script,
    packaging: r.packaging,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listProjects(userId: string): Promise<VideoProject[]> {
  const { data, error } = await getServiceClient().from(TABLE).select(COLUMNS).eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) throw new Error(`Could not read projects (${error.code})`);
  return (data || []).map(toProject);
}

export async function getProject(userId: string, id: string): Promise<VideoProject | null> {
  const { data, error } = await getServiceClient().from(TABLE).select(COLUMNS).eq('user_id', userId).eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not read the project (${error.code})`);
  return data ? toProject(data) : null;
}

export async function createProject(
  userId: string,
  input: { origin: 'opportunity' | 'manual'; title: string; thesis: Thesis | null },
  maxProjects: number
): Promise<VideoProject> {
  const client = getServiceClient();
  const { count, error: countError } = await client
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'ARCHIVED');
  if (countError) throw new Error(`Could not count projects (${countError.code})`);
  if ((count ?? 0) >= maxProjects) throw new ProjectLimitError(maxProjects);

  const { data, error } = await client
    .from(TABLE)
    .insert({ user_id: userId, origin: input.origin, title: input.title, thesis: input.thesis })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`Could not create the project (${error.code})`);
  return toProject(data);
}

/**
 * Updates fields and, optionally, the status. The status change is checked against the state
 * machine and applied only if the row still has the status we read (no lost updates).
 */
export async function updateProject(
  userId: string,
  project: VideoProject,
  changes: {
    title?: string;
    status?: ProjectStatus;
    brief?: unknown;
    script?: unknown;
    packaging?: unknown;
    lastError?: ProjectError | null;
  }
): Promise<VideoProject> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (changes.title !== undefined) row.title = changes.title;
  if (changes.brief !== undefined) row.brief = changes.brief;
  if (changes.script !== undefined) row.script = changes.script;
  if (changes.packaging !== undefined) row.packaging = changes.packaging;
  if (changes.lastError !== undefined) row.last_error = changes.lastError;
  if (changes.status !== undefined && changes.status !== project.status) {
    if (!canTransition(project.status, changes.status, project.archivedFrom)) throw new TransitionError(project.status, changes.status);
    row.status = changes.status;
    row.archived_from = changes.status === 'ARCHIVED' ? project.status : null;
  }

  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update(row)
    .eq('user_id', userId)
    .eq('id', project.id)
    .eq('status', project.status)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Could not save the project (${error.code})`);
  if (!data) throw new TransitionError(project.status, changes.status ?? project.status);
  return toProject(data);
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const { data, error } = await getServiceClient().from(TABLE).delete().eq('user_id', userId).eq('id', id).select('id');
  if (error) throw new Error(`Could not delete the project (${error.code})`);
  return (data || []).length > 0;
}
