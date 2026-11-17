import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { ConfigError } from '../youtube/config';
import { requireUser } from '../youtube/route-auth';
import { getChannelDoctorSettings, getUserAccess, type AffiliateSettings } from '../youtube/settings';
import { StoreError } from './repo';

/** Signed in, and on a plan that includes Affiliate Intelligence and the Store (or an admin testing it). */
export async function requireAffiliate(): Promise<{ user: User; settings: AffiliateSettings } | { response: NextResponse }> {
  const auth = await requireUser();
  if ('response' in auth) return auth;
  const settings = await getChannelDoctorSettings();
  const access = await getUserAccess(auth.user.id, settings);
  if (!access.hasAffiliateAccess) {
    return {
      response: settings.affiliate.enabled
        ? NextResponse.json({ error: 'The Store is not included in your current plan.', code: 'plan' }, { status: 403 })
        : NextResponse.json({ error: 'The Store is not available yet.' }, { status: 503 }),
    };
  }
  return { user: auth.user, settings: settings.affiliate };
}

const STATUS: Record<StoreError['code'], number> = { no_store: 409, has_store: 409, handle_taken: 409, invalid: 400, not_found: 404, db: 502 };

/** Maps known errors to responses; logs only the operation. */
export function storeErrorResponse(err: unknown, operation: string): NextResponse {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return NextResponse.json({ error: issue?.message || 'Check the form.', field: issue?.path.join('.'), code: 'invalid' }, { status: 400 });
  }
  if (err instanceof StoreError) return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
  if (err instanceof ConfigError) {
    console.error(`[store] ${operation}: not configured`);
    return NextResponse.json({ error: 'The Store isn’t set up yet. Please try again later.', code: 'config' }, { status: 503 });
  }
  console.error(`[store] ${operation} failed:`, (err as Error)?.message);
  return NextResponse.json({ error: 'Something failed on our side. Please try again.' }, { status: 500 });
}
