'use client';

import { useAuth } from '@/contexts/auth-context';
import { SCRIPT_CHAR_LIMITS, getNextScriptTier, getScriptCharLimit } from '@/lib/input-limits';

/** Current user's script character limit plus the plan that would raise it. */
export function useScriptCharLimit() {
  const { subscription, isAdmin, isLoading } = useAuth();
  // While the profile is still loading, don't block anyone on a guessed TRIAL
  // limit — server routes enforce the real plan limit regardless.
  if (isLoading) return { limit: SCRIPT_CHAR_LIMITS.STUDIO, nextTier: null };
  const tier = subscription?.tier;
  return {
    limit: getScriptCharLimit(tier, isAdmin),
    nextTier: isAdmin ? null : getNextScriptTier(tier),
  };
}
