import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
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
    redirect('/home');
  }

  // Only the landing page's words go to the browser.
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={{ landing: messages.landing }}>
      <GuestView />
    </NextIntlClientProvider>
  );
}
