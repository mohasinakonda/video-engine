import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from './db';

/**
 * The signed-in user from the server session. Never trust a user id sent by the browser.
 * Returns a 401 response when there is no session.
 */
export async function requireUser(): Promise<{ user: User } | { response: NextResponse }> {
  try {
    const { data } = await createClient().auth.getUser();
    if (data?.user) return { user: data.user };
  } catch {
    // fall through to 401
  }
  return { response: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) };
}

/** Admin check on top of the middleware's, so the route stays safe if the middleware changes. */
export async function requireAdmin(): Promise<{ user: User } | { response: NextResponse }> {
  const auth = await requireUser();
  if ('response' in auth) return auth;
  const { data } = await getServiceClient().from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  if (data?.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return auth;
}
