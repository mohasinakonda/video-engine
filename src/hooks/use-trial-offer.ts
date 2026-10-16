'use client';

import { useEffect, useState } from 'react';

export interface TrialOffer {
  enabled: boolean;
  credits: number;
}

// One request shared by every component that advertises the free trial.
let offerPromise: Promise<TrialOffer | null> | null = null;

function fetchTrialOffer(): Promise<TrialOffer | null> {
  if (!offerPromise) {
    offerPromise = fetch('/api/admin/plan')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const s = data?.settings;
        if (!s) return null;
        const credits = Math.max(0, Number(s.trialCredits ?? 100));
        return { enabled: (s.trialEnabled ?? true) && credits > 0, credits };
      })
      .catch(() => {
        offerPromise = null;
        return null;
      });
  }
  return offerPromise;
}

/**
 * Free sign-up credits as configured in the admin panel.
 * `null` while loading (or if it can't be loaded) — callers should then show neutral copy.
 */
export function useTrialOffer(): TrialOffer | null {
  const [offer, setOffer] = useState<TrialOffer | null>(null);

  useEffect(() => {
    let active = true;
    fetchTrialOffer().then((o) => {
      if (active) setOffer(o);
    });
    return () => {
      active = false;
    };
  }, []);

  return offer;
}
