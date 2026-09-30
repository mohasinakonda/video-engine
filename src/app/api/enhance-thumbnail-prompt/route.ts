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

    const systemPrompt = `You are an award-winning Visual Art Director & Prompt Architect specializing in FLUX.1 and Midjourney v6 cinematography for high-CTR YouTube thumbnails.
Your job is to take the creator's draft thumbnail prompt and elevate it into a breathtaking, ultra-detailed 80-120 word masterwork prompt engineered for maximum mobile click-through rate (CTR).

BLUEPRINT FOR THE ENHANCED PROMPT:
1. SUBJECT & MICRO-EXPRESSION: Detail exact age, posture, intense facial emotion (deep brow furrow, wide eyes of revelation, clenched jaw, or awe), realistic skin micro-textures, pores, and fabric weaves.
2. TANGIBLE HERO METAPHOR / PROP: Concrete physical objects illustrating the core idea (e.g., translucent cranium with glowing brass clockwork gears, cracked obsidian hourglass leaking golden embers, electrical synaptic arcs).
3. CAMERA & OPTICS: Realistic camera optics (e.g., "Shot on 85mm anamorphic cine prime lens, f/1.4 aperture, shallow depth of field with creamy background falloff").
4. CHIAROSCURO & HARD RIM LIGHTING: High-contrast lighting (e.g., "warm golden amber key light paired with razor-sharp electric cyan edge-separation rim lighting") so the subject pops immediately on 120px mobile feeds.
5. ATMOSPHERE & TEXTURE: Volumetric light shafts, floating dust motes, subtle cinematic fog, micro-particles, and rich surface textures.
6. MOBILE COMPOSITION & NEGATIVE SPACE: Rule-of-thirds composition, subject anchored firmly, leaving clean unobstructed dark negative space in the upper-left corner for bold YouTube badge overlays.
7. ARTISTIC STYLE: Seamlessly blend into the designated artistic style: "${styleName}" (${stylePrompt}).

Return strictly valid JSON:
{
  "enhancedPrompt": "Detailed 80-120 word cinematic visual prompt"
}`;

    const userPrompt = `Draft Visual Prompt to Enhance:
"${cleanPrompt}"

${coreTopic ? `Video Core Topic: "${coreTopic}"\n` : ''}Aspect Ratio: ${aspectRatio}
Artistic Visual Style: ${styleName}
Style Guidelines: ${stylePrompt}

Elevate this prompt now into a masterwork FLUX.1 thumbnail prompt.`;

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const pollinationsKey = process.env.POLLINATIONS_API_KEY;

    let enhancedPrompt = '';

    // ─── 1. Groq (Ultra-fast, ~400ms) ────────────────────────────────────────
    if (!enhancedPrompt && groqKey && groqKey.trim()) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.6,
          }),
          signal: AbortSignal.timeout(10000),
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
        console.warn('Groq enhance prompt failed:', err);
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

    // ─── 3. Pollinations Fallback ────────────────────────────────────────────
    if (!enhancedPrompt) {
      try {
        const pollHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (pollinationsKey && pollinationsKey.trim()) {
          pollHeaders['Authorization'] = `Bearer ${pollinationsKey.trim()}`;
        }

        const pollRes = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers: pollHeaders,
          body: JSON.stringify({
            model: 'openai',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.6,
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (pollRes.ok) {
          const data = await pollRes.json();
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
        console.warn('Pollinations enhance prompt failed:', err);
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
