'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import YouTubeKitStudioInner from './youtube-kit-studio-inner';


export default function YouTubeKitStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
        </div>
      }
    >
      <YouTubeKitStudioInner />
    </Suspense>
  );
}
