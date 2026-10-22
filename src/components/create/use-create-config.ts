'use client';

import { useEffect, useState } from 'react';
import type { CreateConfig } from './types';

/** Access and prices for Create, read fresh from the admin settings. */
export function useCreateConfig() {
  const [config, setConfig] = useState<CreateConfig | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/create/config')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setConfig)
      .catch(() => setError(true));
  }, []);
  return { config, error };
}
