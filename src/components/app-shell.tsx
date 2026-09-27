'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AppShellProps {
  children: React.ReactNode;
  initialUser?: User | null;
}

export default function AppShell({ children, initialUser }: AppShellProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser ?? null);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // Fallback
    }
  }, []);

  // Condition: Only hide sidebar on guest home ('/' when not logged in) and auth screens
  const isGuestHome = pathname === '/' && !user;
  const isAuthPage = pathname === '/login' || pathname === '/auth/callback';
  const hideSidebar = isGuestHome || isAuthPage;

  if (hideSidebar) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return (
    <div className="flex min-h-screen w-full bg-bg-base">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
