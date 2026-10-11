import { NextResponse } from 'next/server';
import { authenticateVoiceRequest } from '@/lib/voice-server';

export const dynamic = 'force-dynamic';

/** Simple in-memory per-user rate limit: 30 design assists/hour (each is a paid LLM call). */
const assistCounts = new Map<string, { count: number; resetAt: number }>();
const ASSIST_LIMIT_PER_HOUR = 30;

function assistAllowed(userId: string): boolean {
  const now = Date.now();
  const rec = assistCounts.get(userId);
  if (!rec || now > rec.resetAt) {
    assistCounts.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (rec.count >= ASSIST_LIMIT_PER_HOUR) return false;
  rec.count += 1;
  return true;
}

function getDeepInfraKey(): string | null {
  return process.env.DEEPINFRA_API_KEY || null;
}

async function callLlm(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  const apiKey = getDeepInfraKey();
  if (!apiKey) throw new Error('DEEPINFRA_API_KEY is not configured.');

  const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`LLM call failed (${res.status}): ${err.slice(0, 150)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

export async function POST(req: Request) {
  try {
    const gate = await authenticateVoiceRequest();
    if ('error' in gate) return gate.error;
    const auth = gate.auth;

    if (!assistAllowed(auth.userId)) {
      return NextResponse.json(
        { error: 'Design assistant limit reached. Try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'enhance-prompt';

    if (action === 'enhance-prompt') {
      const userPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      const mode = body.mode === 'director' ? 'director' : 'standard';
      const attributes = body.attributes || {};

      const attrSummary = [
        attributes.gender && `Gender: ${attributes.gender}`,
        attributes.age && `Age: ${attributes.age}`,
        attributes.accent && `Accent/Dialect: ${attributes.accent}`,
        attributes.tone && `Emotion/Tone: ${attributes.tone}`,
        attributes.pace && `Speech Pace: ${attributes.pace}`,
        attributes.texture && `Vocal Texture: ${attributes.texture}`,
        attributes.role && `Persona/Role: ${attributes.role}`,
      ]
        .filter(Boolean)
        .join(', ');

      const systemPrompt = `You are a world-class Voice Director and Acoustic Prompt Engineer specializing in Xiaomi MiMo-V2.5-TTS-VoiceDesign.
Your task is to take a creator's rough voice concept and engineer the OPTIMAL voice description prompt.

MiMo VoiceDesign Official Prompt Rules:
1. Length: 1 to 3 clear, vivid sentences (maximum 4). No unnecessary fluff.
2. Dimensions to cover:
   - Gender & Age (e.g. young woman in her mid-20s, middle-aged man in his 50s, elderly gentleman)
   - Timbre & Vocal Texture (e.g. deep chest resonance, gravelly, silky mellow, breathy, bright and crisp)
   - Mood & Tone (e.g. blunt and matter-of-fact, warm and confident, cynical, gentle with weariness)
   - Speech Speed & Rhythm (e.g. deliberate and slow, brisk pace, slight pauses between thoughts)
   - Persona / Scene Context (optional, e.g. late-night radio DJ, documentary narrator, film noir detective)
3. STRICT NEGATIVE RULES:
   - DO NOT include audio post-processing jargon (NEVER use words like reverb, compression, EQ, 100Hz, stereo).
   - DO NOT combine contradictory descriptors (e.g. "childish voice + deep booming corporate boss").
   - DO NOT use vague words like "normal", "ordinary", "good voice".
${
  mode === 'director'
    ? `4. Output in DIRECTOR MODE format:
[Character] ...
[Scene] ...
[Guidance] ...`
    : `4. Output in STANDARD DESCRIPTIVE format: 1 to 3 vivid sentences.`
}

Return ONLY the refined voice description prompt. Do not wrap in markdown quotes or preamble.`;

      const inputDetails = `User Idea: ${userPrompt || 'A distinct, expressive narrative voice'}${
        attrSummary ? `\nSpecified attributes: ${attrSummary}` : ''
      }`;

      const enhanced = await callLlm(systemPrompt, inputDetails, 0.6);
      return NextResponse.json({ success: true, enhancedPrompt: enhanced, mode });
    }

    if (action === 'match-script') {
      const voicePrompt = typeof body.voicePrompt === 'string' ? body.voicePrompt.trim() : '';
      const topic = typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : 'a dramatic narrative or thought-provoking dialogue';

      if (!voicePrompt) {
        return NextResponse.json({ error: 'voicePrompt is required.' }, { status: 400 });
      }

      const systemPrompt = `You are an expert Scriptwriter and Voice Director for Xiaomi MiMo-V2.5-TTS speech synthesis.
The user will provide a Voice Description for the MiMo-V2.5-TTS-VoiceDesign model.
Your goal is to write 2 distinct, highly expressive script examples that PERFECTLY match the vocal persona and tone.

MiMo Speech Synthesis Audio Tag Rules:
- The model natively performs parenthetical style tags at the beginning, e.g. (Sighing), (Lazy), (Magnetic), (Relieved), (Cold), (singing).
- The model natively performs inline audio micro-tags, e.g. (takes a deep breath), (nervously), (whispers), [pause], (forced smile), (speaking faster), [sigh], [cough].
- Incorporate these tags naturally to maximize speech expressiveness.
- Keep each sample between 15 to 45 words (ideal for instant demonstration).

Return a JSON array of objects with format:
[
  {
    "title": "Short title (e.g., Confession / Morning Coffee)",
    "text": "The script text with embedded audio tags"
  },
  ...
]
Return ONLY valid JSON.`;

      const userMessage = `Voice Description: ${voicePrompt}\nTopic / Context: ${topic}`;
      const raw = await callLlm(systemPrompt, userMessage, 0.7);

      let samples = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        samples = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      } catch {
        samples = [
          {
            title: 'Sample Line',
            text: `(takes a deep breath) After everything that happened... (sighs) I still believe we made the right choice.`,
          },
        ];
      }

      return NextResponse.json({ success: true, samples });
    }

    if (action === 'match-voice') {
      const script = typeof body.script === 'string' ? body.script.trim() : '';
      if (!script) {
        return NextResponse.json({ error: 'script is required.' }, { status: 400 });
      }

      const systemPrompt = `You are a Voice Casting Director for Xiaomi MiMo-V2.5-TTS-VoiceDesign.
Given the creator's script, analyze its emotional tone, character persona, and dramatic rhythm.
Design the PERFECT matching Voice Description prompt following MiMo best practices:
- 1 to 3 vivid sentences.
- Specify Gender & Age, Timbre/Texture, Mood/Tone, and Speech Pace.
- Strictly NO post-processing terms (no reverb, EQ, etc.).
- Output ONLY the voice description text.`;

      const voice = await callLlm(systemPrompt, `Script:\n${script.slice(0, 800)}`, 0.6);
      return NextResponse.json({ success: true, voicePrompt: voice });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[voice/design-prompt] error:', err);
    return NextResponse.json({ error: err?.message || 'Voice prompt assistant error' }, { status: 500 });
  }
}
