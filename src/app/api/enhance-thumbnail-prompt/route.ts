import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const {
      prompt = '',
      coreTopic = '',
      styleName = 'Cinematic Documentary',
      stylePrompt = 'Cinematic lighting, 8k, photorealistic',
      aspectRatio = '16:9',
    } = await req.json();

    const cleanPrompt = (prompt || '').trim();
    if (!cleanPrompt) {
      return NextResponse.json({ error: 'Prompt is required to enhance.' }, { status: 400 });
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

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const deepinfraKey = process.env.DEEPINFRA_API_KEY;

    let enhancedPrompt = '';

    // ─── 1. Groq (Ultra-fast openai/gpt-oss-120b / qwen/qwen3.8-27b) ────────
    if (!enhancedPrompt && groqKey && groqKey.trim()) {
      const groqModels = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
      for (const model of groqModels) {
        if (enhancedPrompt) break;
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey.trim()}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.6,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              const parsed = JSON.parse(content);
              if (parsed.enhancedPrompt) {
                enhancedPrompt = parsed.enhancedPrompt.trim();
                break;
              }
            }
          }
        } catch (err) {
          console.warn(`Groq enhance prompt (${model}) failed:`, err);
        }
      }
    }

    // ─── 2. OpenAI Fallback ──────────────────────────────────────────────────
    if (!enhancedPrompt && openaiKey && openaiKey.trim()) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.6,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.enhancedPrompt) enhancedPrompt = parsed.enhancedPrompt.trim();
          }
        }
      } catch (err) {
        console.warn('OpenAI enhance prompt failed:', err);
      }
    }

    // ─── 3. DeepInfra Fallback ───────────────────────────────────────────────
    if (!enhancedPrompt && deepinfraKey && deepinfraKey.trim()) {
      try {
        const diRes = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${deepinfraKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.6,
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (diRes.ok) {
          const data = await diRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.enhancedPrompt) enhancedPrompt = parsed.enhancedPrompt.trim();
            }
          }
        }
      } catch (err) {
        console.warn('DeepInfra enhance prompt failed:', err);
      }
    }

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
