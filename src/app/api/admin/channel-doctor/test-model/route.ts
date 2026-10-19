import { NextResponse } from 'next/server';
import { z } from 'zod';
import { embed, parseJsonObject } from '@/lib/llm-providers';
import { validateDeepInfraModel } from '@/lib/youtube/settings';
import { requireAdmin } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  kind: z.enum(['text', 'vision', 'embedding']),
  modelId: z.string().trim().min(3).max(120),
});

/** A public YouTube thumbnail used only to check that a vision model reads images. */
const SAMPLE_THUMBNAIL = 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg';

/**
 * POST /api/admin/channel-doctor/test-model — one small real request to a model,
 * reporting the time taken and whether it returned valid JSON.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { kind, modelId } = parsed.data;

  const invalid = await validateDeepInfraModel(modelId, kind);
  if (invalid) return NextResponse.json({ ok: false, error: invalid });

  const key = process.env.DEEPINFRA_API_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: 'DEEPINFRA_API_KEY is not set.' });

  if (kind === 'embedding') {
    const started = Date.now();
    // Two titles that mean the same thing should land close together.
    const result = await embed({ texts: ['Best car vacuum', 'Top vacuums for your car'], models: [modelId], tag: 'test-model' });
    const ms = Date.now() - started;
    if (!result) return NextResponse.json({ ok: false, ms, error: 'The model did not return embeddings.' });
    const [a, b] = result.vectors;
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const similarity = dot / (Math.hypot(...a) * Math.hypot(...b));
    return NextResponse.json({ ok: true, ms, dimensions: a.length, similarity: Math.round(similarity * 100) / 100 });
  }

  const content =
    kind === 'vision'
      ? [
          { type: 'text', text: 'Describe the main subject of this thumbnail. Reply only with JSON: {"subject": "<short phrase>", "hasText": <true|false>}' },
          { type: 'image_url', image_url: { url: SAMPLE_THUMBNAIL } },
        ]
      : 'Reply only with JSON: {"status": "ok", "sum": <the result of 17 + 25>}';

  const started = Date.now();
  try {
    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content }],
        temperature: 0,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const ms = Date.now() - started;
    if (!res.ok) return NextResponse.json({ ok: false, ms, error: `DeepInfra returned ${res.status}.` });

    const data = await res.json();
    const answer: string = data.choices?.[0]?.message?.content || '';
    const json = parseJsonObject(answer);
    return NextResponse.json({
      ok: Boolean(json),
      ms,
      validJson: Boolean(json),
      sample: answer.slice(0, 200),
      error: json ? undefined : 'The model did not return valid JSON.',
    });
  } catch {
    return NextResponse.json({ ok: false, ms: Date.now() - started, error: 'The request timed out or failed.' });
  }
}
