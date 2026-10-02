import { NextResponse } from 'next/server';
import { fetchArtStylesRemote, isSupabaseConfigured } from '@/lib/supabase-service';
import { SUB_STYLES_CATALOG, CORE_FAMILIES } from '@/lib/style-taxonomy';
import { getFileStyles } from '@/lib/server-styles-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    let styles = null;
    let source = 'fallback';

    if (isSupabaseConfigured()) {
      try {
        styles = await fetchArtStylesRemote(false);
        if (styles && styles.length > 0) {
          source = 'supabase';
        }
      } catch (err) {
        console.warn('[/api/styles] Remote fetch failed, falling back:', err);
      }
    }

    // Fallback to server file overrides + local catalog if Supabase is offline or table is empty
    if (!styles || styles.length === 0) {
      const fileOverrides = await getFileStyles();
      const overrideMap = new Map(fileOverrides.map((s) => [s.id, s]));

      // Merge overrides onto catalog
      const baseMerged = SUB_STYLES_CATALOG.map((s) => {
        const override = overrideMap.get(s.id);
        if (override) {
          return { ...s, ...override };
        }
        return s;
      });

      // Add new styles from file overrides not in base catalog
      const baseIds = new Set(SUB_STYLES_CATALOG.map((s) => s.id));
      const newStyles = fileOverrides.filter((s) => !baseIds.has(s.id));

      styles = [...baseMerged, ...newStyles].filter((s) => s.isActive !== false);
      source = 'server_file_catalog';
    }

    return NextResponse.json(
      {
        success: true,
        source,
        total: styles.length,
        families: CORE_FAMILIES,
        styles,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/styles] Error:', err);
    return NextResponse.json({
      success: true,
      source: 'error_fallback',
      total: SUB_STYLES_CATALOG.length,
      families: CORE_FAMILIES,
      styles: SUB_STYLES_CATALOG,
    });
  }
}
