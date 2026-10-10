import { NextResponse } from 'next/server';
import { fetchVoiceModelsRemote, FALLBACK_VOICE_MODELS } from '@/lib/voice-server';

export const dynamic = 'force-dynamic';

/** Active voice engines for the /voice page engine picker (admin-controlled). */
export async function GET() {
  const models = await fetchVoiceModelsRemote();
  const pool = models.length > 0 ? models : FALLBACK_VOICE_MODELS;
  return NextResponse.json({
    success: true,
    models: pool.map((m) => ({
      id: m.id,
      name: m.name,
      modelId: m.modelId,
      description: m.description,
      charsPerCredit: m.charsPerCredit,
      isDefault: m.isDefault,
    })),
  });
}
