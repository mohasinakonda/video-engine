import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { script, pacingProfile = 'balanced', cutPace = 'fast' } = await req.json();

    if (!script || typeof script !== 'string' || !script.trim()) {
      return NextResponse.json({ error: 'Script content is required' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const deepinfraKey = process.env.DEEPINFRA_API_KEY;

    const systemPrompt = `You are an expert cinematic director. Analyze the user's video script and break it down into visually distinct scenes.
Return strictly a valid JSON array of scenes without markdown formatting or surrounding text.

JSON Schema:
[
  {
    "scene_id": 1,
    "narration_line": "Strict string segment from the script",
    "visual_prompt": "Cinematic visual prompt for image generation, highly detailed, photorealistic 8k, style descriptive",
    "shot_type": "wide_shot" | "close_up" | "medium_shot" | "drone_shot" | "extreme_close_up",
    "b_roll_focus": "Subject focus description",
    "audio_start_sec": 0,
    "audio_end_sec": 3.5
  }
]`;

    // ─── 1. Groq Execution (Ultra fast Llama-3.3-70b) ─────────────────────────
    if (groqKey && groqKey.trim()) {
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
              { role: 'user', content: `Script:\n${script}` },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const scenes = Array.isArray(parsed) ? parsed : parsed.scenes || parsed.data || [];
            return NextResponse.json({ scenes, provider: 'groq' });
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
