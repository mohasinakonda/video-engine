'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import DiscoverInner from './discover-inner';

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
        </div>
      }
    >
      <DiscoverInner />
    </Suspense>
  );
}
