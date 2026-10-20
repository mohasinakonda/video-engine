/** Browser-side shapes for the audit (no server internals). */
import type { ThumbnailFindings } from '@/lib/youtube/analysis/thumbnails';
import type { ViewerThemes } from '@/lib/youtube/audit/ai/comments';
import type { ChannelAuditResult } from '@/lib/youtube/audit/channel-audit';
import type { VideoAuditResult } from '@/lib/youtube/audit/video-audit';

export type { AuditFinding, FindingArea, PerformanceLabel } from '@/lib/youtube/audit/video-audit';
export type { ViewerTheme, ThemeKind } from '@/lib/youtube/audit/ai/comments';

export interface VideoAuditReport extends VideoAuditResult {
  video: {
    id: string;
    title: string;
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    publishedAt: string;
    durationSec: number | null;
    views: number | null;
  };
  isOwn: boolean;
  thumbnail: ThumbnailFindings | null;
  viewers: ViewerThemes | null;
  verdict: string;
  lessons: string[];
}

export interface AuditConfig {
  enabled: boolean;
  hasAccess: boolean;
  costs: { video: number; channel: number };
}

export type { RankedVideo } from '@/lib/youtube/audit/channel-audit';

export interface ChannelAuditReport extends ChannelAuditResult {
  isOwn: boolean;
  verdict: string;
  lessons: string[];
}
