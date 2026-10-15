'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_VOICE_CHARS_PER_CREDIT } from '@/lib/plan-pricing';

// One request shared by every pricing card on the page.
let ratePromise: Promise<number> | null = null;

function fetchDefaultVoiceRate(): Promise<number> {
  if (!ratePromise) {
    ratePromise = fetch('/api/voice/models')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const models: { isDefault?: boolean; charsPerCredit?: number }[] = data?.models || [];
        const model = models.find((m) => m.isDefault) || models[0];
        return model?.charsPerCredit && model.charsPerCredit > 0
          ? model.charsPerCredit
          : DEFAULT_VOICE_CHARS_PER_CREDIT;
      })
      .catch(() => {
        ratePromise = null;
        return DEFAULT_VOICE_CHARS_PER_CREDIT;
      });
  }
  return ratePromise;
}

/** Characters per credit of the default voice model (admin-configurable). */
export function useVoiceRate(): number {
  const [charsPerCredit, setCharsPerCredit] = useState(DEFAULT_VOICE_CHARS_PER_CREDIT);

  useEffect(() => {
    let active = true;
    fetchDefaultVoiceRate().then((rate) => {
      if (active) setCharsPerCredit(rate);
    });
    return () => {
      active = false;
    };
  }, []);

  return charsPerCredit;
}
