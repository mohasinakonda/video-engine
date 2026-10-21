/** Browser-side shapes for the audit (no server internals). */
import type { ChannelAuditResult } from '@/lib/youtube/audit/channel-audit';

export type { AuditFinding, FindingArea, FindingImpact, FindingKind, PerformanceLabel } from '@/lib/youtube/audit/video-audit';
export type { ViewerTheme, ThemeKind } from '@/lib/youtube/audit/ai/comments';

export type { VideoAuditOutput as VideoAuditReport } from '@/lib/youtube/audit/run-video';

export interface AuditConfig {
  enabled: boolean;
  hasAccess: boolean;
  costs: { video: number; channel: number; compare: number };
}

export type { RankedVideo } from '@/lib/youtube/audit/channel-audit';

export type { ChannelOverview, OverviewVideo } from '@/lib/youtube/audit/channel-overview';

export interface ChannelAuditReport extends ChannelAuditResult {
  /** Missing on reports saved before it was added; null when it could not be loaded. */
  overview?: import('@/lib/youtube/audit/channel-overview').ChannelOverview | null;
  isOwn: boolean;
  verdict: string;
  lessons: string[];
}

export interface CompareReport {
  yours: import('@/lib/youtube/audit/run-video').VideoAuditOutput;
  theirs: import('@/lib/youtube/audit/run-video').VideoAuditOutput;
  rows: import('@/lib/youtube/audit/compare').CompareRow[];
  differences: import('@/lib/youtube/audit/video-audit').AuditFinding[];
  verdict: string;
  lessons: string[];
}
