import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GuestView from '@/components/guest-view';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let user = null;

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  if (user) {
    redirect('/dashboard');
  }

  return <GuestView />;
}

