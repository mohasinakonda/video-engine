'use client';

import { reportKey } from '@/lib/channel-doctor-storage';
import type { ViewsCheckResult, ViewsCheckRunStage } from '@/lib/youtube/views-check/run';
import { useAnalysisStream } from '../use-diagnosis';

/** The views check for the connected channel, kept in this tab like the diagnosis. */
export function useViewsCheck(userId: string | null, channelId: string | null) {
  return useAnalysisStream<ViewsCheckResult, ViewsCheckRunStage | 'connect' | 'done'>(
    '/api/youtube/views-check',
    userId && channelId ? reportKey(userId, channelId, 'views-check') : null,
    {}
  );
}
