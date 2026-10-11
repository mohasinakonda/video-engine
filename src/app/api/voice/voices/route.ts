import { NextResponse } from 'next/server';
import {
  VOICE_PRESETS,
  VOICE_LANGUAGES,
  EMOTION_TAGS,
  VOICE_DESIGN_PRESETS,
  MIMO_STYLE_TAGS,
  MIMO_INLINE_TAGS,
  type VoicePreset,
} from '@/lib/voice-catalog';
import { fetchVoicePresetsRemote } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Curated and dynamic voice preset catalog for the /voice page. */
export async function GET() {
  let voices: VoicePreset[] = VOICE_PRESETS;

  try {
    const serverClient = createServerClient();
    const remote = await fetchVoicePresetsRemote(serverClient, false);
    if (remote && remote.length > 0) {
      voices = remote;
    }
  } catch (err) {
    console.warn('[API /api/voice/voices] Remote fetch failed, using defaults:', err);
  }

  // Derive unique languages from active presets, unioned with Chatterbox languages
  const languageMap = new Map<string, string>();
  for (const l of VOICE_LANGUAGES) {
    languageMap.set(l.code, l.name);
  }
  for (const v of voices) {
    if (v.languageId && v.language) {
      languageMap.set(v.languageId, v.language);
    }
  }

  const languages = Array.from(languageMap.entries()).map(([code, name]) => ({
    code,
    name,
  }));

  return NextResponse.json({
    success: true,
    voices,
    languages,
    emotionTags: EMOTION_TAGS,
    voiceDesignPresets: VOICE_DESIGN_PRESETS,
    mimoStyleTags: MIMO_STYLE_TAGS,
    mimoInlineTags: MIMO_INLINE_TAGS,
  });
}
