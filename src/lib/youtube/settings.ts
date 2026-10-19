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
  updatedAt: string | null;
}

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
  updatedAt: null,
};

const PLAN_TIERS = ['TRIAL', 'STARTER', 'CREATOR', 'STUDIO'] as const;
const modelId = z.string().trim().min(3).max(120).regex(/^[\w.-]+\/[\w.:-]+$/, 'Use the DeepInfra model id, e.g. owner/model-name');

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
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

/** Read fresh on every request so admin changes apply immediately. */
export async function getChannelDoctorSettings(): Promise<ChannelDoctorSettings> {
  const { data, error } = await getServiceClient().from('channel_doctor_settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return {
    enabled: Boolean(data.enabled),
    allowedPlans: (data.allowed_plans || []).filter((p: string): p is PlanTier => (PLAN_TIERS as readonly string[]).includes(p)),
    diagnosisCreditCost: data.diagnosis_credit_cost,
    videoAnalysisCreditCost: data.video_analysis_credit_cost,
    textModels: data.text_models?.length ? data.text_models : DEFAULT_SETTINGS.textModels,
    visionModels: data.vision_models?.length ? data.vision_models : DEFAULT_SETTINGS.visionModels,
    maxVideos: data.max_videos,
    maxRetentionVideos: data.max_retention_videos,
    maxThumbnails: data.max_thumbnails,
    hourlyLimitPerUser: data.hourly_limit_per_user,
    updatedAt: data.updated_at,
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
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`Could not save settings (${error.code})`);
  return getChannelDoctorSettings();
}

/** The user's effective plan (an expired plan counts as TRIAL) and whether it may run analyses. */
export async function getUserAccess(userId: string, settings: ChannelDoctorSettings) {
  const { data } = await getServiceClient()
    .from('profiles')
    .select('tier, subscription_expires_at')
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
  return { tier, hasAccess: settings.enabled && settings.allowedPlans.includes(tier) };
}

export type ModelKind = 'text' | 'vision';

/**
 * Checks a DeepInfra model before an admin saves it: it must exist, generate text and,
 * for the vision list, accept images. Stops images being sent to a text-only model.
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
  if (info.type !== 'text-generation') return `"${id}" is a ${info.type} model, not a text-generation model.`;
  if (kind === 'vision' && !(info.tags || []).includes('multimodal')) {
    return `"${id}" does not accept images, so it can't analyze thumbnails.`;
  }
  return null;
}
