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

    return NextResponse.json({
      success: true,
      models: models || [],
    });
  } catch (err: any) {
    console.error('[API /api/models] Error fetching models:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch AI models', models: [] },
      { status: 500 }
    );
  }
}
