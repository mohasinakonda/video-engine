/**
 * Runs one streamed Create action (NDJSON from streamAnalysis) and returns its result.
 * Unlike the research hook, nothing is kept in sessionStorage: results are saved on the server.
 */
import type { DiagnosisError } from '@/components/youtube-doctor/use-diagnosis';

/** Same shape as the other streamed features, so the shared error box (with its next step) works. */
export type StreamFailure = DiagnosisError;

export async function runStream<T>(
  endpoint: string,
  body: object,
  onStage?: (stage: string) => void
): Promise<{ ok: true; data: T } | { ok: false; error: StreamFailure }> {
  let res: Response;
  try {
    res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, error: { message: 'The connection failed. Please try again.' } };
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: { message: data.error || 'This couldn’t start.', code: data.code } };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === 'stage') {
        onStage?.(event.stage);
        if (event.stage === 'connect') window.dispatchEvent(new Event('credits_updated'));
      } else if (event.type === 'result') {
        return { ok: true, data: event.data as T };
      } else if (event.type === 'error') {
        window.dispatchEvent(new Event('credits_updated'));
        return { ok: false, error: { message: event.error, code: event.code, refunded: event.refunded } };
      }
    }
  }
  return { ok: false, error: { message: 'The connection was interrupted. Please try again.' } };
}
