import { NextResponse } from 'next/server';
import { TEXT_LIMITS } from '@/lib/input-limits';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const str = (v: unknown, fallback: string, max: number) =>
      (typeof v === 'string' && v.trim() ? v.trim() : fallback).slice(0, max);
    const coreTopic = str(body.coreTopic, '', 300);
    const styleName = str(body.styleName, 'Cinematic Documentary', 100);
    const stylePrompt = str(body.stylePrompt, 'Cinematic lighting, 8k, photorealistic', 1_000);
    const aspectRatio = body.aspectRatio === '9:16' || body.aspectRatio === '1:1' ? body.aspectRatio : '16:9';

    const cleanPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!cleanPrompt) {
      return NextResponse.json({ error: 'Prompt is required to enhance.' }, { status: 400 });
    }
    if (cleanPrompt.length > TEXT_LIMITS.thumbnailPrompt) {
      return NextResponse.json(
        { error: `Thumbnail prompt must be ${TEXT_LIMITS.thumbnailPrompt} characters or fewer.` },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an award-winning Visual Art Director & Prompt Architect specializing in FLUX.1 prompts for high-CTR YouTube thumbnails.
Take the creator's draft thumbnail prompt and sharpen it into a focused 45-75 word prompt that reads instantly on a 120px mobile feed. Bright, bold and simple beats dark and detailed.

BLUEPRINT:
1. ONE dominant subject filling 40-60% of the frame. For people: a close-up face with a strong readable emotion looking at the camera.
2. ONE hero metaphor or prop that signals the core idea. Never more than two ideas.
3. Exactly TWO strongly contrasting saturated colors (e.g. orange vs electric blue).
4. BRIGHT exposure: the subject is the brightest, best-lit element with a strong key light and bright rim light. NEVER mostly black, no pitch-black backgrounds, no extreme chiaroscuro.
5. Simple clean background (gradient or softly blurred) with one calm third of the frame free of detail for a text badge.
6. At most one lens/framing mention. End with "sharp focus, crisp detail, high contrast, bright exposure".
7. Follow the medium of the style "${styleName}" (photograph / illustration / painting), but the brightness and lighting rules above ALWAYS override the style's lighting.
8. TEXT: if the draft asks for rendered text (e.g. text reading "LIGHT NEVER DIES?"), keep the exact same words, spelling and placement in the same form: text reading "..." . If the draft has no text, do not add any.
9. Keep the draft's composition type: a split screen stays a split screen, a single scene stays a single scene.

Return strictly valid JSON:
{
  "enhancedPrompt": "Focused 45-75 word thumbnail prompt"
}`;

    const userPrompt = `Draft Visual Prompt to Enhance:
"${cleanPrompt}"

${coreTopic ? `Video Core Topic: "${coreTopic}"\n` : ''}Aspect Ratio: ${aspectRatio}
Artistic Visual Style: ${styleName}
Style Guidelines: ${stylePrompt}

Elevate this prompt now into a masterwork FLUX.1 thumbnail prompt.`;

    const llm = await callLLM({
      tag: 'enhance-thumbnail-prompt',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      json: true,
      timeoutMs: 25_000,
      accept: (content) => typeof parseJsonObject(content)?.enhancedPrompt === 'string',
    });
    const enhancedPrompt: string = llm ? String(parseJsonObject(llm.content).enhancedPrompt).trim() : '';

    if (!enhancedPrompt) {
      return NextResponse.json(
        { error: 'AI prompt enhancement timed out. Please try again.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ enhancedPrompt });
  } catch (error: any) {
    console.error('API /api/enhance-thumbnail-prompt error:', error);
    return NextResponse.json({ error: error.message || 'Failed to enhance prompt' }, { status: 500 });
  }
}
