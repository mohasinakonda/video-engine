import { NextResponse } from 'next/server';
import {
  fetchVoicePresetsRemote,
  upsertVoicePresetRemote,
  toggleVoicePresetActiveRemote,
  deleteVoicePresetRemote,
  seedDefaultVoicePresetsRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { VoicePreset } from '@/lib/voice-catalog';
import { VOICE_PRESETS } from '@/lib/voice-catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = isSupabaseConfigured();
  let isLiveSupabase = false;
  let presets: VoicePreset[] = [];

  if (configured) {
    try {
      const serverClient = createServerClient();
      const remote = await fetchVoicePresetsRemote(serverClient, true);
      if (remote && remote.length > 0) {
        presets = remote;
        isLiveSupabase = true;
      } else {
        // Fallback to default catalog if empty in database
        presets = VOICE_PRESETS.map((p, idx) => ({
          ...p,
          isDefault: idx === 0,
          isActive: true,
          sortOrder: (idx + 1) * 5,
        }));
      }
    } catch (err) {
      console.warn('[API /api/admin/voice-presets] Remote fetch failed:', err);
      presets = VOICE_PRESETS;
    }
  } else {
    presets = VOICE_PRESETS;
  }

  const activeCount = presets.filter((p) => p.isActive !== false).length;
  const inactiveCount = presets.length - activeCount;

  return NextResponse.json({
    success: true,
    isLiveSupabase,
    total: presets.length,
    activeCount,
    inactiveCount,
    presets,
  });
}

export async function POST(req: Request) {
  try {
    const serverClient = createServerClient();
    const body = await req.json();
    const { action } = body;

    if (action === 'seed') {
      const result = await seedDefaultVoicePresetsRemote(serverClient);
      return NextResponse.json({
        success: result.success,
        count: result.count,
        message: result.success
          ? `Successfully seeded ${result.count} voice presets in Supabase database!`
          : result.error || 'Failed to seed voice presets.',
      });
    }

    if (action === 'upsert') {
      const { preset }: { preset: VoicePreset } = body;
      if (!preset || !preset.name || !preset.languageId) {
        return NextResponse.json(
          { success: false, error: 'Missing required preset fields (name, languageId)' },
          { status: 400 }
        );
      }

      const normalizedPreset: VoicePreset = {
        ...preset,
        id: preset.id || `preset-${preset.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
        description: preset.description || '',
        language: preset.language || 'English',
        languageId: preset.languageId || 'en',
        gender: preset.gender || 'neutral',
        tags: Array.isArray(preset.tags) && preset.tags.length > 0 ? preset.tags : ['narration'],
        exaggeration: Math.max(0, Math.min(1, preset.exaggeration ?? 0.5)),
        isDefault: Boolean(preset.isDefault),
        isActive: preset.isActive !== false,
        sortOrder: preset.sortOrder ?? 10,
      };

      const saved = await upsertVoicePresetRemote(normalizedPreset, serverClient);
      return NextResponse.json({
        success: saved,
        preset: normalizedPreset,
        message: saved
          ? 'Voice preset successfully saved to Supabase!'
          : 'Failed to save voice preset in Supabase.',
      });
    }

    if (action === 'toggle') {
      const { id, isActive }: { id: string; isActive: boolean } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing preset id' }, { status: 400 });
      }

      const toggled = await toggleVoicePresetActiveRemote(id, isActive, serverClient);
      return NextResponse.json({
        success: toggled,
        id,
        isActive,
        message: toggled
          ? `Preset ${isActive ? 'activated' : 'deactivated'} successfully.`
          : 'Failed to update preset status.',
      });
    }

    if (action === 'delete') {
      const { id }: { id: string } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing preset id' }, { status: 400 });
      }

      const deleted = await deleteVoicePresetRemote(id, serverClient);
      return NextResponse.json({
        success: deleted,
        id,
        message: deleted ? 'Voice preset deleted successfully.' : 'Failed to delete voice preset.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/admin/voice-presets] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error processing preset action' },
      { status: 500 }
    );
  }
}
