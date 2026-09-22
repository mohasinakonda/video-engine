'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import StoryboardInner from './storyboard-inner';
// import StoryboardInner from './storyboard-inner';

export default function StoryboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    }>
      <StoryboardInner />
    </Suspense>
  );
}
