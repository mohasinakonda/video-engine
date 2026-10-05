import { NextResponse } from 'next/server';

export const maxDuration = 60; // 60 seconds max timeout for audio transcription

export async function POST(req: Request) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: 'Multipart form data is required.' }, { status: 400 });
    }
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const pollinationsKey = process.env.POLLINATIONS_API_KEY;

    const rawLanguage = (formData.get('language') as string) || '';
    const rawPrompt = (formData.get('prompt') as string) || '';

    // Auto-detect Bengali script in prompt or explicit language
    const isBengali = rawLanguage === 'bn' || /[\u0980-\u09FF]/.test(rawPrompt);
    const language = isBengali ? 'bn' : (rawLanguage || 'en');

    // Anchor prompt with script text to prevent Whisper hallucination loops (max 800 bytes / 240 chars for multi-byte UTF-8)
    let effectivePrompt = '';
    if (rawPrompt.trim()) {
      effectivePrompt = rawPrompt.slice(0, 240).trim();
    } else if (isBengali) {
      effectivePrompt = 'বাংলা স্পষ্ট কথ্যরূপ এবং সঠিক শব্দের নির্ভুল রূপান্তর।';
    }

    // ─── 1. Attempt Groq Whisper Large v3 Turbo (Ultra fast ~1s) ───────────────
    if (groqKey && groqKey.trim()) {
      try {
        const groqFormData = new FormData();
        groqFormData.append('file', file, 'audio.mp3');
        groqFormData.append('model', 'whisper-large-v3-turbo');
        groqFormData.append('response_format', 'verbose_json');
        groqFormData.append('temperature', '0');
        groqFormData.append('timestamp_granularities[]', 'word');
        groqFormData.append('timestamp_granularities[]', 'segment');
        if (language) groqFormData.append('language', language);
        if (effectivePrompt) groqFormData.append('prompt', effectivePrompt);

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey.trim()}`,
          },
          body: groqFormData,
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          return NextResponse.json({ ...data, provider: 'groq' });
        } else {
          console.warn('Groq whisper returned non-OK status:', groqRes.status, await groqRes.text());
        }
      } catch (err) {
        console.warn('Groq transcription error in route:', err);
      }
    }

    // ─── 2. Attempt OpenAI Whisper-1 ───────────────────────────────────────────
    if (openaiKey && openaiKey.trim()) {
      try {
        const openaiFormData = new FormData();
        openaiFormData.append('file', file, 'audio.mp3');
        openaiFormData.append('model', 'whisper-1');
        openaiFormData.append('response_format', 'verbose_json');
        openaiFormData.append('temperature', '0');
        openaiFormData.append('timestamp_granularities[]', 'word');
        openaiFormData.append('timestamp_granularities[]', 'segment');
        if (language) openaiFormData.append('language', language);
        if (effectivePrompt) openaiFormData.append('prompt', effectivePrompt);

        const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey.trim()}`,
          },
          body: openaiFormData,
        });

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          return NextResponse.json({ ...data, provider: 'openai' });
        }
      } catch (err) {
        console.warn('OpenAI whisper error in route:', err);
      }
    }

    // ─── 3. Fallback to Pollinations AI Whisper ────────────────────────────────
    try {
      const polFormData = new FormData();
      polFormData.append('file', file, 'audio.mp3');
      polFormData.append('model', 'openai/whisper-large-v3');
      polFormData.append('response_format', 'verbose_json');
      polFormData.append('temperature', '0');
      polFormData.append('timestamp_granularities[]', 'word');
      polFormData.append('timestamp_granularities[]', 'segment');
      if (language) polFormData.append('language', language);
      if (effectivePrompt) polFormData.append('prompt', effectivePrompt);

      const headers: Record<string, string> = {};
      if (pollinationsKey && pollinationsKey.trim()) {
        headers['Authorization'] = `Bearer ${pollinationsKey.trim()}`;
      }

      const polRes = await fetch('https://gen.pollinations.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers,
        body: polFormData,
      });

      if (polRes.ok) {
        const data = await polRes.json();
        return NextResponse.json({ ...data, provider: 'pollinations' });
      }
    } catch (err) {
      console.warn('Pollinations whisper error in route:', err);
    }

    return NextResponse.json(
      { error: 'All Whisper transcription providers failed.' },
      { status: 502 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown transcription error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
