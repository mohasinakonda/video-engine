import { NextResponse } from 'next/server';
import {
  fetchArtStylesRemote,
  upsertArtStyleRemote,
  toggleArtStyleActiveRemote,
  deleteArtStyleRemote,
  seedDefaultArtStylesRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import { SUB_STYLES_CATALOG, CORE_FAMILIES } from '@/lib/style-taxonomy';
import {
  getFileStyles,
  saveStyleToFile,
  toggleStyleInFile,
  deleteStyleFromFile,
} from '@/lib/server-styles-store';
import type { BaseStylePreset } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = isSupabaseConfigured();
  let isLiveSupabase = false;
  let styles: BaseStylePreset[] = [];

  if (configured) {
    try {
      const remote = await fetchArtStylesRemote(true);
      if (remote && remote.length > 0) {
        styles = remote;
        isLiveSupabase = true;
      }
    } catch (err) {
      console.warn('[API /api/admin/styles] Remote fetch failed:', err);
    }
  }

  // Fallback to local file overrides + local catalog if remote is empty or unconfigured
  if (styles.length === 0) {
    const fileOverrides = await getFileStyles();
    const overrideMap = new Map(fileOverrides.map((s) => [s.id, s]));

    // Map base catalog with overrides applied
    const baseMerged = SUB_STYLES_CATALOG.map((s, idx) => {
      const override = overrideMap.get(s.id);
      if (override) {
        return {
          ...s,
          ...override,
          sortOrder: override.sortOrder ?? (idx + 1) * 10,
        };
      }
      return {
        ...s,
        isActive: true,
        sortOrder: (idx + 1) * 10,
      };
    });

    // Add any completely new styles from file overrides not in base catalog
    const baseIds = new Set(SUB_STYLES_CATALOG.map((s) => s.id));
    const newStyles = fileOverrides.filter((s) => !baseIds.has(s.id));

    styles = [...baseMerged, ...newStyles];
  }

  const activeCount = styles.filter((s) => s.isActive !== false).length;
  const inactiveCount = styles.length - activeCount;

  return NextResponse.json({
    success: true,
    isLiveSupabase,
    total: styles.length,
    activeCount,
    inactiveCount,
    families: CORE_FAMILIES,
    styles,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'seed') {
      const result = await seedDefaultArtStylesRemote();
      return NextResponse.json({
        success: result.success,
        count: result.count,
        message: result.success
          ? `Successfully synced & seeded ${result.count} art styles to Supabase!`
          : result.error || 'Failed to seed styles to Supabase table.',
      });
    }

    if (action === 'upsert') {
      const { style }: { style: BaseStylePreset } = body;
      if (!style || !style.id || !style.name || !style.stylePrompt) {
        return NextResponse.json(
          { success: false, error: 'Missing required style fields (id, name, stylePrompt)' },
          { status: 400 }
        );
      }

      // 1. Always persist to server-side JSON store
      await saveStyleToFile(style);

      // 2. Attempt remote sync to Supabase art_styles table
      let savedRemote = false;
      if (isSupabaseConfigured()) {
        try {
          savedRemote = await upsertArtStyleRemote(style);
        } catch (err) {
          console.warn('[API /api/admin/styles] Remote upsert failed:', err);
        }
      }

      return NextResponse.json({
        success: true,
        savedRemote,
        style,
        message: savedRemote
          ? 'Art style saved to Supabase cloud and local server!'
          : 'Art style saved locally on server (Supabase table not yet synced).',
      });
    }

    if (action === 'toggle') {
      const { id, isActive }: { id: string; isActive: boolean } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing style id' }, { status: 400 });
      }

      await toggleStyleInFile(id, isActive);

      let toggledRemote = false;
      if (isSupabaseConfigured()) {
        try {
          toggledRemote = await toggleArtStyleActiveRemote(id, isActive);
        } catch (err) {
          console.warn('[API /api/admin/styles] Remote toggle failed:', err);
        }
      }

      return NextResponse.json({
        success: true,
        toggledRemote,
        id,
        isActive,
        message: `Style ${isActive ? 'enabled' : 'disabled'} successfully.`,
      });
    }

    if (action === 'delete') {
      const { id }: { id: string } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing style id' }, { status: 400 });
      }

      await deleteStyleFromFile(id);

      let deletedRemote = false;
      if (isSupabaseConfigured()) {
        try {
          deletedRemote = await deleteArtStyleRemote(id);
        } catch (err) {
          console.warn('[API /api/admin/styles] Remote delete failed:', err);
        }
      }

      return NextResponse.json({
        success: true,
        deletedRemote,
        id,
        message: 'Art style deleted.',
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/admin/styles] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
