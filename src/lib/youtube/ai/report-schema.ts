import { z } from 'zod';

/**
 * What the AI must return. Confidence is NOT asked of the model: it is copied from the
 * deterministic finding for that category, so it always reflects the evidence.
 */

export const BOTTLENECK_CATEGORIES = ['packaging', 'retention', 'topic', 'acquisition', 'consistency'] as const;

const evidenceIds = z.array(z.string().max(60)).min(1).max(6);

const bottleneckSchema = z.object({
  category: z.enum(BOTTLENECK_CATEGORIES),
  title: z.string().trim().min(3).max(90),
  explanation: z.string().trim().min(10).max(400),
  evidenceIds,
});

export const aiReportSchema = z.object({
  /** One plain sentence a creator understands at a glance. */
  headline: z.string().trim().min(10).max(110),
  summary: z.string().trim().min(20).max(400),
  primaryBottleneck: bottleneckSchema.nullable(),
  secondaryBottlenecks: z.array(bottleneckSchema).max(3),
  strengths: z
    .array(z.object({ title: z.string().trim().min(3).max(90), explanation: z.string().trim().min(10).max(400), evidenceIds }))
    .max(4),
  actions: z
    .array(
      z.object({
        priority: z.number().int().min(1).max(5),
        title: z.string().trim().min(3).max(90),
        why: z.string().trim().min(10).max(300),
        how: z.string().trim().min(10).max(320),
        evidenceIds,
        effort: z.enum(['low', 'medium', 'high']),
        expectedImpact: z.enum(['potentially_high', 'moderate', 'low']),
      })
    )
    .min(1)
    .max(5),
});

export type AiReport = z.infer<typeof aiReportSchema>;
