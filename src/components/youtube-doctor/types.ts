/** Browser-side shapes returned by /api/youtube/* (no tokens, ever). */

export type ConnectionStatus = 'active' | 'needs_reauth' | 'revoked';

export interface PublicConnection {
  channelId: string;
  title: string | null;
  thumbnail: string | null;
  url: string;
  status: ConnectionStatus;
  reportingStartedAt: string | null;
}

export interface ChannelStats {
  subscriberCount: number | null;
  videoCount: number | null;
  url: string;
}

export type ConnectionState =
  | { connected: false }
  | { connected: true; connection: PublicConnection; stats: ChannelStats | null };

export interface DoctorConfig {
  enabled: boolean;
  hasAccess: boolean;
  tier: string;
  allowedPlans: string[];
  diagnosisCost: number;
  videoCost: number;
}
