'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiagnosisResult } from '@/lib/youtube/diagnosis';
import type { DiagnosisStage, RangeKey } from '@/lib/youtube/types';
import { loadReport, reportKey, saveReport } from '@/lib/channel-doctor-storage';

export interface DiagnosisError {
  message: string;
  code?: 'plan' | 'credits' | 'reauth' | 'not_connected' | 'limit';
  refunded?: boolean;
}

interface SavedReport<T> {
  analyzedAt: string;
  result: T;
}

/** Channel diagnosis for the connected channel and period. */
export function useDiagnosis(userId: string | null, channelId: string | null, range: RangeKey) {
  return useAnalysisStream<DiagnosisResult>(
    '/api/youtube/diagnosis',
    userId && channelId ? reportKey(userId, channelId, range) : null,
    { range }
  );
}

/**
 * Runs an analysis through its NDJSON stream, tracks the real stages (and the counts some
 * stages report), and keeps the finished result in this tab's sessionStorage under `key`.
 */
export function useAnalysisStream<T, S extends string = DiagnosisStage>(endpoint: string, key: string | null, body: object) {
  const [stages, setStages] = useState<S[]>([]);
  const [counts, setCounts] = useState<Partial<Record<S, number>>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<DiagnosisError | null>(null);
  const [saved, setSaved] = useState<SavedReport<T> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSaved(key ? loadReport<T>(key) : null);
    setError(null);
  }, [key]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (!key || running) return;
    setRunning(true);
    setError(null);
    setStages([]);
    setCounts({});
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError({ message: data.error || 'The analysis could not start.', code: data.code });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'stage') {
            setStages((prev) => (prev.includes(event.stage) ? prev : [...prev, event.stage]));
            if (typeof event.count === 'number') setCounts((prev) => ({ ...prev, [event.stage]: event.count }));
            // Credits were taken: let the header balance refresh.
            if (event.stage === 'connect') window.dispatchEvent(new Event('credits_updated'));
          } else if (event.type === 'result') {
            saveReport(key, event.data);
            setSaved({ analyzedAt: new Date().toISOString(), result: event.data });
            finished = true;
          } else if (event.type === 'error') {
            setError({ message: event.error, code: event.code, refunded: event.refunded });
            window.dispatchEvent(new Event('credits_updated'));
            finished = true;
          }
        }
      }
      if (!finished) setError({ message: 'The connection was interrupted before the report finished. Please try again.' });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError({ message: 'The connection was interrupted. Please try again.' });
      }
    } finally {
      setRunning(false);
    }
    // The body is serialized per run; callers pass a fresh object with the current inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, key, JSON.stringify(body), running]);

  return { run, running, stages, counts, error, saved };
}
