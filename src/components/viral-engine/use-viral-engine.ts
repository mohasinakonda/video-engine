'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeShort } from '@/lib/viral-engine/engine';
import { extractShort, extractThumbs, ExtractError, type ExtractProgress, type Thumb } from '@/lib/viral-engine/extract';
import type { ViralStage } from '@/lib/viral-engine/server/run';
import { VIRAL_RESULT_VERSION, type ShortFormat, type ViralResult } from '@/lib/viral-engine/types';

export type Phase = 'idle' | 'extracting' | 'analyzing';

export interface RunInput {
  file: File;
  videoLink: string;
  /** Compare with the connected channel. */
  useChannel: boolean;
  title: string;
  hashtags: string[];
  language: 'en' | 'bn';
}

export interface ViralError {
  message: string;
  code?: string;
  refunded?: boolean;
}

/** The video and its timeline frames: in this tab's memory only, never uploaded or stored. */
export interface LocalMedia {
  videoUrl: string;
  thumbs: Thumb[];
}

interface Limits {
  maxDurationSec: number;
  maxBodyFrames: number;
}

const storageKey = (userId: string) => `viral-engine:v${VIRAL_RESULT_VERSION}:${userId}`;

function load(userId: string): ViralResult | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as ViralResult) : null;
    if (parsed?.version !== VIRAL_RESULT_VERSION) return null;
    // The rules run in the browser, so a saved report always shows the latest rules for free.
    return { ...parsed, report: analyzeShort(parsed.input) };
  } catch {
    return null;
  }
}

function save(userId: string, result: ViralResult) {
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(result));
  } catch {
    // Storage full or blocked: the report still shows until the tab closes.
  }
}

/**
 * Runs the Viral Engine: local extraction (free), then the NDJSON analysis stream (credits charged
 * there). The report is kept in this tab's sessionStorage only.
 */
export function useViralEngine(userId: string | null, limits: Limits | null) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [extract, setExtract] = useState<ExtractProgress | null>(null);
  const [stages, setStages] = useState<ViralStage[]>([]);
  const [error, setError] = useState<ViralError | null>(null);
  const [result, setResult] = useState<ViralResult | null>(null);
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setResult(userId ? load(userId) : null);
  }, [userId]);

  // Revoke the old video URL when it is replaced or the page closes.
  useEffect(() => () => {
    if (media) URL.revokeObjectURL(media.videoUrl);
  }, [media]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Leaving mid-run loses the local work; warn first.
  useEffect(() => {
    if (phase === 'idle') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const run = useCallback(
    /** Resolves true when a new report arrived. */
    async (input: RunInput): Promise<boolean> => {
      if (!userId || !limits || phase !== 'idle') return false;
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setStages([]);
      setPhase('extracting');

      let extraction;
      try {
        extraction = await extractShort(input.file, {
          maxDurationSec: limits.maxDurationSec,
          maxBodyFrames: limits.maxBodyFrames,
          language: input.language,
          onProgress: setExtract,
          signal: controller.signal,
        });
      } catch (err) {
        // Cancelling before anything was charged isn't an error.
        if (!controller.signal.aborted) {
          setError({ message: err instanceof ExtractError || err instanceof Error ? err.message : 'Could not read this video.' });
        }
        setPhase('idle');
        setExtract(null);
        return false;
      }

      setPhase('analyzing');
      try {
        const res = await fetch('/api/viral-engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: { name: input.file.name, size: input.file.size, durationSec: extraction.signals.durationSec },
            hookFrames: extraction.hookFrames,
            sheets: extraction.sheets,
            signals: extraction.signals,
            videoLink: input.videoLink.trim() || null,
            useChannel: input.useChannel,
            metadata: { title: input.title.trim(), hashtags: input.hashtags },
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setError({ message: data.error || 'The analysis could not start.', code: data.code });
          return false;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;
        let ok = false;
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
              if (event.stage === 'connect') window.dispatchEvent(new Event('credits_updated'));
            } else if (event.type === 'result') {
              const data = event.data as ViralResult;
              save(userId, data);
              setResult(data);
              setMedia({ videoUrl: URL.createObjectURL(input.file), thumbs: extraction.thumbs });
              finished = true;
              ok = true;
            } else if (event.type === 'error') {
              setError({ message: event.error, code: event.code, refunded: event.refunded });
              window.dispatchEvent(new Event('credits_updated'));
              finished = true;
            }
          }
        }
        if (!finished) setError({ message: 'The connection was interrupted before the report finished. Please try again.' });
        return ok;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError({ message: 'The connection was interrupted. Please try again.' });
        return false;
      } finally {
        setPhase('idle');
        setExtract(null);
      }
    },
    [userId, limits, phase]
  );

  /** After a reload: the same file again brings back the player and timeline frames (free, local). */
  const restoreMedia = useCallback(
    async (file: File) => {
      if (!result) return;
      if (file.name !== result.file.name || file.size !== result.file.size) {
        setError({ message: 'That isn’t the same file as this report. Pick the file you analysed, or run a new check.' });
        return;
      }
      setError(null);
      setRestoring(0);
      try {
        const thumbs = await extractThumbs(file, setRestoring);
        setMedia({ videoUrl: URL.createObjectURL(file), thumbs });
      } catch (err) {
        setError({ message: (err as Error).message || 'Could not read this video.' });
      } finally {
        setRestoring(null);
      }
    },
    [result]
  );

  /** Re-runs the rules with a corrected format. Free: the engine runs in the browser. */
  const setFormat = useCallback(
    (format: ShortFormat) => {
      if (!result || !userId) return;
      const input = { ...result.input, formatOverride: format };
      const next = { ...result, input, report: analyzeShort(input) };
      save(userId, next);
      setResult(next);
    },
    [result, userId]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    if (userId) {
      try {
        window.sessionStorage.removeItem(storageKey(userId));
      } catch {
        // ignore
      }
    }
    setResult(null);
    setMedia(null);
    setError(null);
  }, [userId]);

  return { phase, extract, stages, error, result, media, restoring, run, restoreMedia, setFormat, cancel, clear };
}
