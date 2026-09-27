'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (newSession) {
            authListener.subscription.unsubscribe();
            router.replace('/dashboard');
          }
        });
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-zinc-300 font-semibold tracking-wide">
          Verifying Google Sign-In...
        </p>
        <p className="text-[11px] text-zinc-500">Redirecting to your creator dashboard</p>
      </div>
    </div>
  );
}
