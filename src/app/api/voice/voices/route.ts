import { NextResponse } from 'next/server';
import { INWORLD_VOICES, INWORLD_LANGUAGES, EMOTION_TAGS } from '@/lib/inworld-voices';

export const dynamic = 'force-dynamic';

/** Curated voice browser data for the /voice page. */
export async function GET() {
  return NextResponse.json({
    success: true,
    voices: INWORLD_VOICES,
    languages: INWORLD_LANGUAGES,
    emotionTags: EMOTION_TAGS,
  });
}
