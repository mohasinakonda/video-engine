'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VideoProject } from './types';

/** Loads one project once access is confirmed. `'missing'` covers both not found and not yours. */
export function useProject(id: string, enabled: boolean) {
  const [project, setProject] = useState<VideoProject | null | 'missing'>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/create/projects/${id}`);
    if (!res.ok) return setProject('missing');
    setProject((await res.json()).project);
  }, [id]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return { project, setProject };
}
