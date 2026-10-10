import { NextResponse } from 'next/server';
import { VOICE_PRESETS, VOICE_LANGUAGES, EMOTION_TAGS } from '@/lib/voice-catalog';

export const dynamic = 'force-dynamic';

/** Curated voice preset catalog for the /voice page. */
export async function GET() {
  return NextResponse.json({
    success: true,
    voices: VOICE_PRESETS,
    languages: VOICE_LANGUAGES,
    emotionTags: EMOTION_TAGS,
  });
}
