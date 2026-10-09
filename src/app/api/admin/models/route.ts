import { NextResponse } from 'next/server';
import {
  fetchAIModelsRemote,
  upsertAIModelRemote,
  toggleAIModelActiveRemote,
  deleteAIModelRemote,
  seedDefaultAIModelsRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { AIImageModel } from '@/types/subscription';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = isSupabaseConfigured();
  let isLiveSupabase = false;
  let models: AIImageModel[] = [];

  if (configured) {
    try {
      const serverClient = createServerClient();
      const remote = await fetchAIModelsRemote(serverClient, true);
      if (remote) {
        models = remote;
        isLiveSupabase = true;
      }
    } catch (err) {
      console.warn('[API /api/admin/models] Remote fetch failed:', err);
    }
  }

  const activeCount = models.filter((m) => m.isActive !== false).length;
  const inactiveCount = models.length - activeCount;

  return NextResponse.json({
    success: true,
    isLiveSupabase,
    total: models.length,
    activeCount,
    inactiveCount,
    models,
  });
}

export async function POST(req: Request) {
  try {
    const serverClient = createServerClient();
    const body = await req.json();
    const { action } = body;

    if (action === 'seed') {
      const result = await seedDefaultAIModelsRemote(serverClient);
      return NextResponse.json({
        success: result.success,
        count: result.count,
        message: result.success
          ? `Successfully seeded ${result.count} AI models in Supabase database!`
          : result.error || 'Failed to seed AI models.',
      });
    }

    if (action === 'upsert') {
      const { model }: { model: AIImageModel } = body;
      if (!model || !model.name || !model.modelId) {
        return NextResponse.json(
          { success: false, error: 'Missing required model fields (name, modelId)' },
          { status: 400 }
        );
      }

      // Ensure stable id if not provided
      const normalizedModel: AIImageModel = {
        ...model,
        id: model.id || model.modelId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase(),
        provider: 'deepinfra',
        creditCost: typeof model.creditCost === 'number' ? Math.max(0, model.creditCost) : 2,
        allowedPlans: Array.isArray(model.allowedPlans) && model.allowedPlans.length > 0
          ? model.allowedPlans
          : ['CREATOR', 'STUDIO'],
        inferenceSteps: model.inferenceSteps ?? 4,
        guidanceScale: model.guidanceScale ?? 1.0,
        sortOrder: model.sortOrder ?? 10,
        isDefault: Boolean(model.isDefault),
        isActive: model.isActive !== false,
      };

      const saved = await upsertAIModelRemote(normalizedModel, serverClient);
      return NextResponse.json({
        success: saved,
        model: normalizedModel,
        message: saved ? 'AI Model successfully saved to Supabase!' : 'Failed to save model in Supabase.',
      });
    }

    if (action === 'toggle') {
      const { id, isActive }: { id: string; isActive: boolean } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing model id' }, { status: 400 });
      }

      const toggled = await toggleAIModelActiveRemote(id, isActive, serverClient);
      return NextResponse.json({
        success: toggled,
        id,
        isActive,
        message: toggled
          ? `Model ${isActive ? 'enabled' : 'disabled'} successfully.`
          : 'Failed to update model status.',
      });
    }

    if (action === 'delete') {
      const { id }: { id: string } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing model id' }, { status: 400 });
      }

      const deleted = await deleteAIModelRemote(id, serverClient);
      return NextResponse.json({
        success: deleted,
        id,
        message: deleted ? 'Model deleted successfully.' : 'Failed to delete model.',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/admin/models] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error processing request' },
      { status: 500 }
    );
  }
}
