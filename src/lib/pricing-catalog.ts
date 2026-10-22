/**
 * What the public pricing page shows about the YouTube growth tools and image models, built from
 * the admin settings so a price changed in admin is the price shown. Pure: no network.
 */
import type { ChannelDoctorSettings } from './youtube/settings';
import type { AIImageModel, PlanTier } from '@/types/subscription';

export type GrowthToolId = 'doctor' | 'discover' | 'create' | 'audit';

export interface GrowthTool {
  id: GrowthToolId;
  name: string;
  /** One line on what it does for the creator. */
  pitch: string;
  /** Plans that include it; empty when it's switched off. */
  plans: PlanTier[];
  prices: { label: string; credits: number }[];
  /** Free runs on the Trial plan (Channel Doctor's diagnosis); 0 when there are none. */
  freeOnTrial: number;
}

export interface PricingCatalog {
  tools: GrowthTool[];
  images: { name: string; credits: number; plans: PlanTier[] }[];
}

export function pricingCatalog(s: ChannelDoctorSettings, models: AIImageModel[]): PricingCatalog {
  const on = (enabled: boolean, plans: PlanTier[]) => (enabled ? plans : []);
  const c = s.create;
  const included = [
    c.bundleBriefDrafts > 0 && `${c.bundleBriefDrafts} briefs`,
    c.bundleScriptWrites > 0 && `${c.bundleScriptWrites} scripts`,
    c.bundlePackagingRuns > 0 && `${c.bundlePackagingRuns} title & thumbnail runs`,
  ].filter(Boolean);
  const tools: GrowthTool[] = [
    {
      id: 'doctor',
      name: 'Channel Doctor',
      pitch: 'Finds why your channel isn’t growing, from your own YouTube Analytics.',
      plans: on(s.enabled, s.allowedPlans),
      prices: [
        { label: 'Full channel diagnosis', credits: s.diagnosisCreditCost },
        { label: 'One video analyzed', credits: s.videoAnalysisCreditCost },
      ],
      freeOnTrial: s.enabled ? s.trialFreeDiagnoses : 0,
    },
    {
      id: 'discover',
      name: 'Discover',
      pitch: 'Tracks your competitors and tells you what to make next.',
      plans: on(s.discover.enabled, s.discover.allowedPlans),
      prices: [
        { label: 'Find competitors', credits: s.discover.discoveryCreditCost },
        { label: 'Market research with video ideas', credits: s.discover.researchCreditCost },
      ],
      freeOnTrial: 0,
    },
    {
      id: 'create',
      name: 'Create',
      pitch: 'Turns an idea into a brief, a script, titles and thumbnails.',
      plans: on(c.enabled, c.allowedPlans),
      prices: [{ label: included.length ? `Per video (includes ${included.join(', ')})` : 'Per video', credits: c.bundleCreditCost }],
      freeOnTrial: 0,
    },
    {
      id: 'audit',
      name: 'Video & channel analysis',
      pitch: 'Shows why any video or channel works, yours or a competitor’s.',
      plans: on(s.audit.enabled && s.discover.enabled, s.discover.allowedPlans),
      prices: [
        { label: 'Analyze a video', credits: s.audit.videoAuditCreditCost },
        { label: 'Analyze a channel', credits: s.audit.channelAuditCreditCost },
      ],
      freeOnTrial: 0,
    },
  ];
  const images = models
    .filter((m) => m.isActive && !m.id.startsWith('voice-'))
    .sort((a, b) => a.creditCost - b.creditCost)
    .map((m) => ({ name: m.name, credits: m.creditCost, plans: m.allowedPlans }));
  return { tools, images };
}
