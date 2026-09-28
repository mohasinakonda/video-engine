'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Condition: Only hide sidebar on guest home ('/' when not logged in) and auth screens
  const isGuestHome = pathname === '/' && !user;
  const isAuthPage = pathname === '/login' || pathname === '/auth/callback';
  const hideSidebar = isGuestHome || isAuthPage;

  if (hideSidebar) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return (
    <div className="flex h-screen w-full bg-bg-base overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellLayout>{children}</ShellLayout>
    </AuthProvider>
  );
}
