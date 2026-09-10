'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ExportInner from './export-inner';

export default function ExportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          <Loader2 size={24} className="animate-spin text-accent-purple" />
        </div>
      }
    >
      <ExportInner />
    </Suspense>
  );
}
