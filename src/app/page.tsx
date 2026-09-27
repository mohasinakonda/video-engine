import { createClient } from '@/lib/supabase/server';
import GuestView from '@/components/guest-view';
import UserDashboardView from '@/components/user-dashboard-view';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let user = null;

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // If Supabase keys are not set up yet or cookies are unavailable
    user = null;
  }

  // 1. Unauthenticated / Guest View
  if (!user) {
    return <GuestView />;
  }

  // 2. Authenticated / Logged-in View
  return <UserDashboardView user={user} />;
}
