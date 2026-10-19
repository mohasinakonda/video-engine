import { z } from 'zod';
import { FORMATS } from '../discover/formats';
import type { Thesis } from './types';

const level = z.enum(['low', 'medium', 'high']);
const score = z.number().min(0).max(100).nullable();

/**
 * The parts of a Discover opportunity the browser may send to start a project. Anything else
 * (competitor titles, views, evidence text) is dropped here and never stored.
 */
export const opportunityInputSchema = z.object({
  id: z.string().min(1).max(80),
  topic: z.string().trim().min(1).max(120),
  recommendedAngle: z.string().trim().max(160).nullable(),
  recommendedFormat: z.enum(FORMATS).nullable(),
  gapTypes: z.array(z.enum(['coverage', 'audience_problem', 'format', 'packaging', 'emerging'])).max(5),
  momentum: z.enum(['recent', 'durable', 'one_off', 'none']),
  competition: level,
  channelFit: level,
  productionDifficulty: level.nullable(),
  confidence: level,
  scores: z.object({
    total: z.number().min(0).max(100),
    channelFit: score,
    competitorPerformance: score,
    momentum: score,
    contentGap: score,
    competition: score,
    productionFit: score,
    phase1: score,
  }),
  signalsUsed: z.number().int().min(0).max(10),
  window: z.enum(['30d', '90d']),
  generatedAt: z.string().datetime(),
});
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

export function toThesis(o: OpportunityInput): Thesis {
  return {
    version: 1,
    opportunityId: o.id,
    topic: o.topic,
    recommendedAngle: o.recommendedAngle,
    recommendedFormat: o.recommendedFormat,
    gapTypes: o.gapTypes,
    momentum: o.momentum,
    competition: o.competition,
    channelFit: o.channelFit,
    productionDifficulty: o.productionDifficulty,
    confidence: o.confidence,
    scores: o.scores,
    signalsUsed: o.signalsUsed,
    window: o.window,
    researchedAt: o.generatedAt,
  };
}
