import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { script } = await req.json();

    if (!script || typeof script !== 'string' || !script.trim()) {
      return NextResponse.json({ error: 'Script content is required' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const deepinfraKey = process.env.DEEPINFRA_API_KEY;

    const systemPrompt = `You are an expert cinematic director for an AI video studio.
Analyze the user's video script and break it down into visually distinct, cinematographically rich scenes.
Return strictly a valid JSON array of scenes without markdown formatting or surrounding text.

STILL IMAGE PROMPT MANDATES (FLUX.1 OPTIMIZED):
1. LENGTH: 30-50 words maximum per visual_prompt (concise, sharp, punchy).
2. ZERO VIDEO JARGON: Never use "drone footage", "footage", "camera pans", "camera zooms out", "zooming", "animation", "video clip". Describe a single static frozen photographic moment.
3. SINGLE COHERENT LIGHTING: Specify exactly ONE dominant lighting scheme (e.g. dramatic low-key chiaroscuro with subtle rim lighting). NEVER mix contradictory lighting directives like "balanced natural lighting" with "near-total pitch blackness".
4. STATIC DECISIVE MOMENT: Describe the resulting visual state. NEVER write "in the moment just after the switch is flipped" or "a second before".
5. ZERO NEGATIVE STRINGS: NEVER output "(avoid: ...)", "avoid:", or negative exclusion lists in visual_prompt. Output 100% PURE positive visual tokens.
6. ABSTRACT PHYSICS TRANSLATOR: Translate abstract/quantum phenomena (photons, molecules, redshift, spacetime) into tangible cinematic visuals (e.g. razor-sharp coherent laser beams in deep space void, volumetric Tyndall dust motes, period chalkboard tensor equations, prismatic spectrum dispersion).
7. SPATIAL & OPTICAL ANCHORS: Explicitly describe spatial arrangement (in the foreground, centered in frame, in the background) and tangible light vectors. Strictly avoid hype buzzwords like "8k", "photorealistic", "masterpiece", or "hyperrealistic".

JSON Schema:
[
  {
    "scene_id": 1,
    "narration_line": "Strict string segment from the script",
    "visual_prompt": "A 35mm cinematic film still of [subject, single lighting key, spatial layout, physical environment]",
    "shot_type": "wide_shot" | "close_up" | "medium_shot" | "extreme_close_up",
    "b_roll_focus": "Subject focus description",
    "audio_start_sec": 0,
    "audio_end_sec": 3.5
  }
]`;

    // ─── 1. DeepInfra Primary LLM (Meta-Llama-3.1-70B-Instruct) ─────────────
    if (deepinfraKey && deepinfraKey.trim()) {
      try {
        const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepinfraKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Script:\n${script}` },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const startIdx = content.indexOf('[');
            const endIdx = content.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
              const scenes = JSON.parse(content.slice(startIdx, endIdx + 1));
              return NextResponse.json({ scenes, provider: 'deepinfra' });
            }
          }
        }
      } catch (err) {
        console.warn('DeepInfra script breakdown failed:', err);
      }
    }

    // ─── 2. Groq Execution Fallback ─────────────────────────────────────────
    if (groqKey && groqKey.trim()) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Script:\n${script}` },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const startIdx = content.indexOf('[');
            const endIdx = content.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
              const scenes = JSON.parse(content.slice(startIdx, endIdx + 1));
              return NextResponse.json({ scenes, provider: 'groq' });
            }
          }
        }
      } catch (err) {
        console.warn('Groq script breakdown failed:', err);
      }
    }

    // ─── 2. OpenAI Execution (GPT-4o-mini) ───────────────────────────────────
    if (openaiKey && openaiKey.trim()) {
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
              { role: 'user', content: `Script:\n${script}` },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const scenes = Array.isArray(parsed) ? parsed : parsed.scenes || parsed.data || [];
            return NextResponse.json({ scenes, provider: 'openai' });
          }
        }
      } catch (err) {
        console.warn('OpenAI script breakdown failed:', err);
      }
    }

    // ─── 3. Fallback: Pollinations AI Text ────────────────────────────────────
    const pollRes = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Script:\n${script}` },
        ],
        model: 'openai',
      }),
    });

    if (pollRes.ok) {
      const text = await pollRes.text();
      try {
        const jsonStart = text.indexOf('[');
        const jsonEnd = text.lastIndexOf(']') + 1;
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const jsonStr = text.substring(jsonStart, jsonEnd);
          const scenes = JSON.parse(jsonStr);
          return NextResponse.json({ scenes, provider: 'pollinations' });
        }
      } catch {
        // fallback parsing below
      }
    }

    return NextResponse.json({ error: 'Failed to break down script into scenes' }, { status: 500 });
  } catch (error: any) {
    console.error('API /api/breakdown-script error:', error);
    return NextResponse.json({ error: error.message || 'Script processing failed' }, { status: 500 });
  }
}
