'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ChannelDoctorInner from './channel-doctor-inner';

export default function ChannelDoctorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
        </div>
      }
    >
      <ChannelDoctorInner />
    </Suspense>
  );
}
