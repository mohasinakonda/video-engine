import { z } from 'zod';
import { getServiceClient } from './db';
import { profileEffectiveTier } from '@/lib/input-limits';
import type { PlanTier } from '@/types/subscription';

/** Admin-controlled Channel Doctor settings (table channel_doctor_settings, single row). */
export interface ChannelDoctorSettings {
  enabled: boolean;
  allowedPlans: PlanTier[];
  diagnosisCreditCost: number;
  videoAnalysisCreditCost: number;
  /** Ordered: the first model is tried first, the rest are fallbacks. */
  textModels: string[];
  visionModels: string[];
  maxVideos: number;
  maxRetentionVideos: number;
  maxThumbnails: number;
  hourlyLimitPerUser: number;
  discover: DiscoverSettings;
  create: CreateSettings;
  updatedAt: string | null;
}

/** Admin-controlled Create (Phase 3) settings, stored on the same row. */
export interface CreateSettings {
  enabled: boolean;
  allowedPlans: PlanTier[];
  briefCreditCost: number;
  scriptCreditCost: number;
  packagingCreditCost: number;
  performanceCreditCost: number;
  /** Days after publishing when performance is compared with the channel's usual. */
  checkpointDays: number[];
  /** Measured videos needed before a learning pattern is shown. */
  learningMinVideos: number;
  maxProjectsPerUser: number;
}

export const DEFAULT_CREATE_SETTINGS: CreateSettings = {
  enabled: false,
  allowedPlans: ['CREATOR', 'STUDIO'],
  briefCreditCost: 2,
  scriptCreditCost: 5,
  packagingCreditCost: 5,
  performanceCreditCost: 2,
  checkpointDays: [1, 2, 7, 28],
  learningMinVideos: 3,
  maxProjectsPerUser: 100,
};

/** Weights of the opportunity score dimensions (docs/discover-plan.md §7.2). They sum to 100. */
export interface OpportunityWeights {
  channelFit: number;
  competitorPerformance: number;
  momentum: number;
  contentGap: number;
  competition: number;
  productionFit: number;
  phase1: number;
  /** How the creator's own measured videos in this format or topic did (Create). */
  trackRecord: number;
}

/** Admin-controlled Discover (Phase 2) settings, stored on the same row. */
export interface DiscoverSettings {
  enabled: boolean;
  allowedPlans: PlanTier[];
  discoveryCreditCost: number;
  researchCreditCost: number;
  opportunityCreditCost: number;
  maxCompetitors: number;
  videosPerCompetitor: number;
  searchCallsPerDiscovery: number;
  /** Our share of YouTube's 100 search.list calls per day, for all users together. */
  searchDailyGlobalLimit: number;
  discoveryRunsPerUserDay: number;
  /** Ordered: the first model is tried first, the rest are fallbacks. */
  embeddingModels: string[];
  maxCompetitorThumbnails: number;
  weights: OpportunityWeights;
}

export const DEFAULT_WEIGHTS: OpportunityWeights = {
  channelFit: 20,
  competitorPerformance: 15,
  momentum: 15,
  contentGap: 15,
  competition: 10,
  productionFit: 10,
  phase1: 5,
  trackRecord: 10,
};

/** The defaults before the track record existed. */
const PREVIOUS_DEFAULT_WEIGHTS = { channelFit: 25, competitorPerformance: 20, momentum: 15, contentGap: 15, competition: 10, productionFit: 10, phase1: 5 };

/**
 * Weights saved before the track record existed: untouched defaults move to the new defaults;
 * weights an admin tuned are kept as they are, with the track record at 0 until they set it.
 */
export function upgradeWeights(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || 'trackRecord' in raw) return raw;
  const old = raw as Record<string, unknown>;
  const untouched = Object.entries(PREVIOUS_DEFAULT_WEIGHTS).every(([k, v]) => old[k] === v);
  return untouched ? DEFAULT_WEIGHTS : { ...old, trackRecord: 0 };
}

export const DEFAULT_DISCOVER_SETTINGS: DiscoverSettings = {
  enabled: false,
  allowedPlans: ['CREATOR', 'STUDIO'],
  discoveryCreditCost: 5,
  researchCreditCost: 15,
  opportunityCreditCost: 3,
  maxCompetitors: 10,
  videosPerCompetitor: 50,
  searchCallsPerDiscovery: 3,
  searchDailyGlobalLimit: 80,
  discoveryRunsPerUserDay: 2,
  embeddingModels: ['BAAI/bge-m3', 'Qwen/Qwen3-Embedding-0.6B'],
  maxCompetitorThumbnails: 10,
  weights: DEFAULT_WEIGHTS,
};

export const DEFAULT_SETTINGS: ChannelDoctorSettings = {
  enabled: true,
  allowedPlans: ['STARTER', 'CREATOR', 'STUDIO'],
  diagnosisCreditCost: 10,
  videoAnalysisCreditCost: 3,
  textModels: ['deepseek-ai/DeepSeek-V4-Flash-0731', 'nvidia/NVIDIA-Nemotron-3.5-Lightning'],
  visionModels: ['Qwen/Qwen3-VL-30B-A3B-Instruct', 'google/gemma-3-27b-it'],
  maxVideos: 100,
  maxRetentionVideos: 8,
  maxThumbnails: 12,
  hourlyLimitPerUser: 10,
  discover: DEFAULT_DISCOVER_SETTINGS,
  create: DEFAULT_CREATE_SETTINGS,
  updatedAt: null,
};

const PLAN_TIERS = ['TRIAL', 'STARTER', 'CREATOR', 'STUDIO'] as const;
const modelId = z.string().trim().min(3).max(120).regex(/^[\w.-]+\/[\w.:-]+$/, 'Use the DeepInfra model id, e.g. owner/model-name');

const weight = z.number().int().min(0).max(100);
export const weightsSchema = z
  .object({
    channelFit: weight,
    competitorPerformance: weight,
    momentum: weight,
    contentGap: weight,
    competition: weight,
    productionFit: weight,
    phase1: weight,
    trackRecord: weight,
  })
  .refine((w) => Object.values(w).reduce((sum, v) => sum + v, 0) === 100, 'The weights must add up to 100');

export const discoverSettingsSchema = z.object({
  enabled: z.boolean(),
  allowedPlans: z.array(z.enum(PLAN_TIERS)).max(4),
  discoveryCreditCost: z.number().int().min(0).max(1000),
  researchCreditCost: z.number().int().min(0).max(1000),
  opportunityCreditCost: z.number().int().min(0).max(1000),
  maxCompetitors: z.number().int().min(1).max(25),
  videosPerCompetitor: z.number().int().min(15).max(100),
  searchCallsPerDiscovery: z.number().int().min(1).max(5),
  searchDailyGlobalLimit: z.number().int().min(0).max(100_000),
  discoveryRunsPerUserDay: z.number().int().min(0).max(50),
  embeddingModels: z.array(modelId).min(1).max(5),
  maxCompetitorThumbnails: z.number().int().min(0).max(30),
  weights: weightsSchema,
});

const credit = z.number().int().min(0).max(1000);
export const createSettingsSchema = z.object({
  enabled: z.boolean(),
  allowedPlans: z.array(z.enum(PLAN_TIERS)).max(4),
  briefCreditCost: credit,
  scriptCreditCost: credit,
  packagingCreditCost: credit,
  performanceCreditCost: credit,
  checkpointDays: z
    .array(z.number().int().min(1).max(90))
    .min(1)
    .max(8)
    .transform((days) => Array.from(new Set(days)).sort((a, b) => a - b)),
  learningMinVideos: z.number().int().min(2).max(50),
  maxProjectsPerUser: z.number().int().min(1).max(10_000),
});

/** What an admin may save. Mirrors the database CHECK constraints. */
export const settingsUpdateSchema = z.object({
  enabled: z.boolean(),
  allowedPlans: z.array(z.enum(PLAN_TIERS)).max(4),
  diagnosisCreditCost: z.number().int().min(0).max(1000),
  videoAnalysisCreditCost: z.number().int().min(0).max(1000),
  textModels: z.array(modelId).min(1).max(5),
  visionModels: z.array(modelId).min(1).max(5),
  maxVideos: z.number().int().min(10).max(200),
  maxRetentionVideos: z.number().int().min(0).max(20),
  maxThumbnails: z.number().int().min(0).max(24),
  hourlyLimitPerUser: z.number().int().min(1).max(100),
  discover: discoverSettingsSchema,
  create: createSettingsSchema,
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

/** Read fresh on every request so admin changes apply immediately. */
export async function getChannelDoctorSettings(): Promise<ChannelDoctorSettings> {
  const { data, error } = await getServiceClient().from('channel_doctor_settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return {
    enabled: Boolean(data.enabled),
    allowedPlans: toPlans(data.allowed_plans),
    diagnosisCreditCost: data.diagnosis_credit_cost,
    videoAnalysisCreditCost: data.video_analysis_credit_cost,
    textModels: data.text_models?.length ? data.text_models : DEFAULT_SETTINGS.textModels,
    visionModels: data.vision_models?.length ? data.vision_models : DEFAULT_SETTINGS.visionModels,
    maxVideos: data.max_videos,
    maxRetentionVideos: data.max_retention_videos,
    maxThumbnails: data.max_thumbnails,
    hourlyLimitPerUser: data.hourly_limit_per_user,
    discover: readDiscover(data),
    create: readCreate(data),
    updatedAt: data.updated_at,
  };
}

const toPlans = (plans: string[] | null | undefined): PlanTier[] =>
  (plans || []).filter((p): p is PlanTier => (PLAN_TIERS as readonly string[]).includes(p));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readCreate(data: Record<string, any>): CreateSettings {
  const d = DEFAULT_CREATE_SETTINGS;
  return {
    enabled: data.create_enabled ?? d.enabled,
    allowedPlans: data.create_allowed_plans ? toPlans(data.create_allowed_plans) : d.allowedPlans,
    briefCreditCost: data.brief_credit_cost ?? d.briefCreditCost,
    scriptCreditCost: data.script_credit_cost ?? d.scriptCreditCost,
    packagingCreditCost: data.packaging_credit_cost ?? d.packagingCreditCost,
    performanceCreditCost: data.performance_credit_cost ?? d.performanceCreditCost,
    checkpointDays: data.checkpoint_days?.length ? data.checkpoint_days : d.checkpointDays,
    learningMinVideos: data.learning_min_videos ?? d.learningMinVideos,
    maxProjectsPerUser: data.max_projects_per_user ?? d.maxProjectsPerUser,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readDiscover(data: Record<string, any>): DiscoverSettings {
  const d = DEFAULT_DISCOVER_SETTINGS;
  const weights = weightsSchema.safeParse(upgradeWeights(data.opportunity_weights));
  return {
    enabled: data.discover_enabled ?? d.enabled,
    allowedPlans: data.discover_allowed_plans ? toPlans(data.discover_allowed_plans) : d.allowedPlans,
    discoveryCreditCost: data.discovery_credit_cost ?? d.discoveryCreditCost,
    researchCreditCost: data.research_credit_cost ?? d.researchCreditCost,
    opportunityCreditCost: data.opportunity_credit_cost ?? d.opportunityCreditCost,
    maxCompetitors: data.max_competitors ?? d.maxCompetitors,
    videosPerCompetitor: data.videos_per_competitor ?? d.videosPerCompetitor,
    searchCallsPerDiscovery: data.search_calls_per_discovery ?? d.searchCallsPerDiscovery,
    searchDailyGlobalLimit: data.search_daily_global_limit ?? d.searchDailyGlobalLimit,
    discoveryRunsPerUserDay: data.discovery_runs_per_user_day ?? d.discoveryRunsPerUserDay,
    embeddingModels: data.embedding_models?.length ? data.embedding_models : d.embeddingModels,
    maxCompetitorThumbnails: data.max_competitor_thumbnails ?? d.maxCompetitorThumbnails,
    weights: weights.success ? weights.data : d.weights,
  };
}

export async function saveChannelDoctorSettings(update: SettingsUpdate): Promise<ChannelDoctorSettings> {
  const { error } = await getServiceClient()
    .from('channel_doctor_settings')
    .upsert({
      id: 1,
      enabled: update.enabled,
      allowed_plans: Array.from(new Set(update.allowedPlans)),
      diagnosis_credit_cost: update.diagnosisCreditCost,
      video_analysis_credit_cost: update.videoAnalysisCreditCost,
      text_models: update.textModels,
      vision_models: update.visionModels,
      max_videos: update.maxVideos,
      max_retention_videos: update.maxRetentionVideos,
      max_thumbnails: update.maxThumbnails,
      hourly_limit_per_user: update.hourlyLimitPerUser,
      discover_enabled: update.discover.enabled,
      discover_allowed_plans: Array.from(new Set(update.discover.allowedPlans)),
      discovery_credit_cost: update.discover.discoveryCreditCost,
      research_credit_cost: update.discover.researchCreditCost,
      opportunity_credit_cost: update.discover.opportunityCreditCost,
      max_competitors: update.discover.maxCompetitors,
      videos_per_competitor: update.discover.videosPerCompetitor,
      search_calls_per_discovery: update.discover.searchCallsPerDiscovery,
      search_daily_global_limit: update.discover.searchDailyGlobalLimit,
      discovery_runs_per_user_day: update.discover.discoveryRunsPerUserDay,
      embedding_models: update.discover.embeddingModels,
      max_competitor_thumbnails: update.discover.maxCompetitorThumbnails,
      opportunity_weights: update.discover.weights,
      create_enabled: update.create.enabled,
      create_allowed_plans: Array.from(new Set(update.create.allowedPlans)),
      brief_credit_cost: update.create.briefCreditCost,
      script_credit_cost: update.create.scriptCreditCost,
      packaging_credit_cost: update.create.packagingCreditCost,
      performance_credit_cost: update.create.performanceCreditCost,
      checkpoint_days: update.create.checkpointDays,
      learning_min_videos: update.create.learningMinVideos,
      max_projects_per_user: update.create.maxProjectsPerUser,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`Could not save settings (${error.code})`);
  return getChannelDoctorSettings();
}

/**
 * The user's effective plan (an expired plan counts as TRIAL) and whether it may run
 * Channel Doctor analyses (`hasAccess`) and Discover research (`hasDiscoverAccess`).
 */
export async function getUserAccess(userId: string, settings: ChannelDoctorSettings) {
  const { data } = await getServiceClient()
    .from('profiles')
    .select('tier, subscription_expires_at, role')
    .eq('id', userId)
    .maybeSingle();
  const tier = profileEffectiveTier(
    data
      ? {
          tier: data.tier,
          subscriptionExpiresAt: data.subscription_expires_at ? new Date(data.subscription_expires_at).getTime() : null,
        }
      : null
  );
  // Admins can use Discover while it is switched off for users (testing before launch).
  const isAdmin = data?.role === 'admin';
  return {
    tier,
    isAdmin,
    hasAccess: settings.enabled && settings.allowedPlans.includes(tier),
    hasDiscoverAccess: isAdmin || (settings.discover.enabled && settings.discover.allowedPlans.includes(tier)),
    hasCreateAccess: isAdmin || (settings.create.enabled && settings.create.allowedPlans.includes(tier)),
  };
}

export type ModelKind = 'text' | 'vision' | 'embedding';

/**
 * Checks a DeepInfra model before an admin saves it: it must exist, generate text (or, for
 * the embedding list, embeddings) and, for the vision list, accept images. Stops images being sent to a text-only model.
 */
export async function validateDeepInfraModel(id: string, kind: ModelKind): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`https://api.deepinfra.com/models/${id}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch {
    return `Could not reach DeepInfra to check "${id}". Try again.`;
  }
  if (res.status === 404) return `"${id}" was not found on DeepInfra.`;
  if (!res.ok) return `DeepInfra returned ${res.status} for "${id}".`;

  const info = await res.json().catch(() => null);
  if (!info) return `Could not read DeepInfra's details for "${id}".`;
  if (info.deprecated) return `"${id}" is deprecated on DeepInfra.`;
  if (kind === 'embedding') {
    return info.type === 'embeddings' ? null : `"${id}" is a ${info.type} model, not an embeddings model.`;
  }
  if (info.type !== 'text-generation') return `"${id}" is a ${info.type} model, not a text-generation model.`;
  if (kind === 'vision' && !(info.tags || []).includes('multimodal')) {
    return `"${id}" does not accept images, so it can't analyze thumbnails.`;
  }
  return null;
}
