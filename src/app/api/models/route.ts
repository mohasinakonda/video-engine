import { NextResponse } from 'next/server';
import { fetchAIModelsRemote } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let serverClient: any = null;
    try {
      serverClient = createServerClient();
    } catch {
      // Fallback to default client
    }

    const models = await fetchAIModelsRemote(serverClient, false);
    // Exclude voice models (stored with 'voice-' prefix in ai_models table)
    const imageModels = (models || []).filter((m) => !m.id.startsWith('voice-'));

    return NextResponse.json({
      success: true,
      models: imageModels,
    });
  } catch (err: any) {
    console.error('[API /api/models] Error fetching models:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch AI models', models: [] },
      { status: 500 }
    );
  }
}
