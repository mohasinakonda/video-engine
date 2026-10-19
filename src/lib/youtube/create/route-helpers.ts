import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import { NotConnectedError, ReauthRequiredError } from '../connection-service';
import { GoogleApiError } from '../google-fetch';
import { requireUser } from '../route-auth';
import { getChannelDoctorSettings, getUserAccess, type CreateSettings } from '../settings';
import { ProjectLimitError, TransitionError, getProject } from './projects';
import type { VideoProject } from './types';

/** Signed in, and allowed to use Create (plan, or admin while it's switched off for users). */
export async function requireCreate(): Promise<{ user: User; settings: CreateSettings } | { response: NextResponse }> {
  const auth = await requireUser();
  if ('response' in auth) return auth;
  const settings = await getChannelDoctorSettings();
  const access = await getUserAccess(auth.user.id, settings);
  if (!access.hasCreateAccess) {
    return {
      response: settings.create.enabled
        ? NextResponse.json({ error: 'Create is not included in your current plan.', code: 'plan' }, { status: 403 })
        : NextResponse.json({ error: 'Create is not available yet.' }, { status: 503 }),
    };
  }
  return { user: auth.user, settings: settings.create };
}

export const projectIdSchema = z.string().uuid();

/** The project, only if it belongs to the signed-in user (404 otherwise, never 403: no existence leak). */
export async function ownedProject(userId: string, id: string): Promise<VideoProject | NextResponse> {
  const parsed = projectIdSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const project = await getProject(userId, parsed.data);
  return project ?? NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/** Maps known errors to responses; logs only the operation and an error code. */
export function projectErrorResponse(err: unknown, operation: string): NextResponse {
  if (err instanceof NotConnectedError) return NextResponse.json({ error: 'Connect your YouTube channel first.', code: 'not_connected' }, { status: 409 });
  if (err instanceof ReauthRequiredError || (err instanceof GoogleApiError && err.kind === 'auth')) {
    return NextResponse.json({ error: 'Your YouTube connection needs to be renewed.', code: 'reauth' }, { status: 409 });
  }
  if (err instanceof GoogleApiError && err.kind === 'quota') return NextResponse.json({ error: 'YouTube is busy right now. Please try again later.', code: 'quota' }, { status: 503 });
  if (err instanceof GoogleApiError) return NextResponse.json({ error: 'YouTube couldn’t be reached. Please try again.', code: 'youtube' }, { status: 502 });
  if (err instanceof TransitionError) return NextResponse.json({ error: err.message, code: 'transition' }, { status: 409 });
  if (err instanceof ProjectLimitError) return NextResponse.json({ error: err.message, code: 'limit' }, { status: 409 });
  console.error(`[create] ${operation} failed:`, (err as Error)?.message);
  return NextResponse.json({ error: 'Something failed on our side. Please try again.' }, { status: 500 });
}
