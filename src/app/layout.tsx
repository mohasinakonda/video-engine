import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'AI Video Studio',
  description: 'Convert long-form narration scripts into cinematic video & audio — powered by Pollinations AI.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-base text-slate-100 antialiased">
        <AppShell initialUser={user}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
