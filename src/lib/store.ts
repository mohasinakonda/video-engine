/**
 * store.ts — Web SaaS Persistent Data Storage Engine
 *
 * Backed by browser localStorage & IndexedDB for instant, persistent access:
 *  - Settings & API keys
 *  - Voice presets
 *  - Project manifests
 *  - Base Style Presets
 */

import type { VoicePreset, ProjectManifest, BaseStylePreset } from '@/types';
import { deleteProjectMedia } from './media-storage';

// ─── Generic Web Store Helpers ────────────────────────────────────────────────

function storeGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

function storeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota error
  }
}

// ─── API Key & Settings Accessors ─────────────────────────────────────────────

let cachedEnvPollinationsKey: string | null = null;

export async function getApiKey(): Promise<string> {
  return getPollinationsApiKey();
}

export async function saveApiKey(apiKey: string): Promise<void> {
  storeSet('pollinations-api-key', apiKey);
}

export async function getPollinationsApiKey(): Promise<string> {
  if (typeof process !== 'undefined' && process.env?.POLLINATIONS_API_KEY) {
    return process.env.POLLINATIONS_API_KEY.trim();
  }
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_POLLINATIONS_API_KEY) {
    return process.env.NEXT_PUBLIC_POLLINATIONS_API_KEY.trim();
  }
  if (cachedEnvPollinationsKey !== null) {
    return cachedEnvPollinationsKey;
  }
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/pollinations-key');
      if (res.ok) {
        const data = await res.json();
        if (data.key) {
          cachedEnvPollinationsKey = data.key;
          return data.key;
        }
      }
    } catch {
      // fallback
    }
  }
  return storeGet<string>('pollinations-api-key') || '';
}

export async function savePollinationsApiKey(apiKey: string): Promise<void> {
  storeSet('pollinations-api-key', apiKey);
}

export async function getPollinationsImageModel(): Promise<string> {
  return storeGet<string>('pollinations-image-model') || 'flux';
}

export async function savePollinationsImageModel(model: string): Promise<void> {
  storeSet('pollinations-image-model', model);
}

export async function getYouTubeApiKey(): Promise<string> {
  if (typeof process !== 'undefined' && process.env?.YOUTUBE_API_KEY) {
    return process.env.YOUTUBE_API_KEY.trim();
  }
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_YOUTUBE_API_KEY) {
    return process.env.NEXT_PUBLIC_YOUTUBE_API_KEY.trim();
  }
  return storeGet<string>('youtube-api-key') || '';
}

export async function saveYouTubeApiKey(key: string): Promise<void> {
  storeSet('youtube-api-key', key.trim());
}

// ─── Voice Presets Accessors ──────────────────────────────────────────────────

export async function getPresets(): Promise<VoicePreset[]> {
  return storeGet<VoicePreset[]>('voice-presets') || [];
}

export async function savePreset(preset: VoicePreset): Promise<void> {
  const presets = await getPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    presets[idx] = preset;
  } else {
    presets.push(preset);
  }
  storeSet('voice-presets', presets);
}

export async function deletePreset(id: string): Promise<void> {
  const presets = await getPresets();
  storeSet('voice-presets', presets.filter((p) => p.id !== id));
}

export async function setDefaultPreset(id: string): Promise<void> {
  const presets = await getPresets();
  const updated = presets.map((p) => ({ ...p, isDefault: p.id === id }));
  storeSet('voice-presets', updated);
}

export async function getDefaultPreset(): Promise<VoicePreset | null> {
  const presets = await getPresets();
  return presets.find((p) => p.isDefault) ?? presets[0] ?? null;
}

// ─── Project Manifests Accessors ──────────────────────────────────────────────

export async function getAllProjects(): Promise<ProjectManifest[]> {
  const projects = storeGet<ProjectManifest[]>('projects') || [];
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(projectId: string): Promise<ProjectManifest | null> {
  const projects = await getAllProjects();
  return projects.find((p) => p.projectId === projectId) ?? null;
}

export async function saveProject(manifest: ProjectManifest): Promise<void> {
  const projects = await getAllProjects();
  const idx = projects.findIndex((p) => p.projectId === manifest.projectId);

  // Sanitize manifest so ephemeral browser blob: URLs are never stored in localStorage
  const sanitizedManifest: ProjectManifest = {
    ...manifest,
    scenes: manifest.scenes?.map(({ imageUrl, ...s }) => {
      // Keep real URLs (https:// or data:image), but never persist session-scoped blob: URLs
      if (imageUrl && !imageUrl.startsWith('blob:')) {
        return { ...s, imageUrl };
      }
      return s;
    }),
    audioChunks: manifest.audioChunks?.map(({ audioUrl, ...c }) => {
      if (audioUrl && !audioUrl.startsWith('blob:')) {
        return { ...c, audioUrl };
      }
      return c;
    }),
  };

  if (idx >= 0) {
    projects[idx] = sanitizedManifest;
  } else {
    projects.push(sanitizedManifest);
  }
  storeSet('projects', projects);
}

export async function deleteProject(projectId: string): Promise<void> {
  const projects = await getAllProjects();
  storeSet('projects', projects.filter((p) => p.projectId !== projectId));
  await deleteProjectMedia(projectId);
}

// ─── Phase 2: Built-in Style Presets ──────────────────────────────────────────

export const BUILT_IN_STYLE_PRESETS: BaseStylePreset[] = [
  {
    id: 'builtin_cinematic',
    name: 'Dark Cinematic Documentary',
    familyId: 'cinematic',
    tag: '35mm IMAX Film',
    stylePrompt:
      'Cinematic 35mm anamorphic photography, photorealistic 8k ultra-detailed, dramatic chiaroscuro lighting, muted desaturated color grade, deep shadows with warm highlight accents, masterwork composition with rule-of-thirds framing, film grain texture, shallow depth of field, professional documentary cinematography, IMAX quality',
    negativePrompt: 'cartoon, anime, blurry, distorted faces, low resolution, CGI, oversaturated, watermark, text, flat illustration, modern UI elements',
    aspectRatio: '16:9',
    isDefault: true,
    isBuiltIn: true,
    createdAt: 0,
    thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'builtin_artisan_linocut',
    name: 'Artisan Linocut Masterwork',
    familyId: 'printmaking',
    tag: 'Hand-Carved Relief',
    stylePrompt:
      'Intricate masterwork linocut relief print by an artisan printmaker, deeply carved woodblock print style. Chiseled relief grooves, rough tactile ink press texture on fibrous cream archival paper, heavy contrasting black ink, sharp carved contours, rich hatching and crosshatching, master printmaking aesthetic, award-winning linoleum block art',
    negativePrompt: 'photorealism, 3D render, CGI, glossy digital illustration, smooth vector gradients, plastic textures, modern UI, neon colors, oversaturated, pure white background, blurry, text, watermark, bad anatomy, no modern graphics, no flat vectors',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
    thumbnailUrl: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/1790875798525_image.webp',
  },
  {
    id: 'builtin_conceptual_illustration',
    name: 'Conceptual Illustration',
    familyId: 'printmaking',
    tag: 'Warm Archival Paper',
    stylePrompt:
      'Conceptual illustration in a traditional hand-carved linocut and relief-print style printed on warm textured off-white archival paper (#F1E7D0). Hand-carved woodblock aesthetic with rough irregular carved edges, visible ink texture, coarse paper grain, organic cross-hatching, stippling and dot patterns, carved negative space details, and expressive silhouettes. Strict limited print palette: warm aged ivory cream paper, deep charcoal-green primary ink (#17251F), muted forest green (#486044), dusty sage olive (#718064), and muted terracotta peach sky (#D98267) with faded peach highlights (#E9B49A). Tonal transitions rendered exclusively via halftone dots, stippling, and carved line density without smooth digital gradients. Poetic visual metaphor and symbolic transformation connecting subject with landscape, layered rolling hills, foliage motifs, and hidden narrative details. Print-based chiaroscuro with strong silhouettes and exposed cream paper highlights. Subtle vintage aged paper border, museum-quality editorial relief art print',
    negativePrompt:
      'photorealism, 3D render, CGI, glossy digital illustration, smooth vector gradients, plastic textures, modern UI, neon colors, oversaturated, pure white, pure black, blurry, text, watermark, bad anatomy',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'builtin_anime',
    name: 'Anime / Manga',
    familyId: 'animation',
    tag: 'Ghibli Hand-Drawn',
    stylePrompt:
      'High-quality anime illustration, detailed hand-drawn style, vibrant colors, clean linework, dramatic lighting, Studio Ghibli inspired',
    negativePrompt: 'realistic, photograph, 3D render, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'builtin_cyberpunk',
    name: 'Cyberpunk Neon City',
    familyId: 'cinematic',
    tag: 'Neon Rain Metropolis',
    stylePrompt:
      'Futuristic cyberpunk aesthetic, neon lights, rain-slicked streets, ultra-detailed digital art, volumetric fog, holographic displays, blade runner inspired',
    negativePrompt: 'natural, daylight, countryside, low tech, sketch, watermark',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'builtin_flat_vector',
    name: '2D Flat Vector',
    familyId: 'graphic',
    tag: 'Clean Explainer',
    stylePrompt:
      'Modern 2D flat design illustration, bold clean shapes, minimal shadows, geometric forms, professional corporate explainer video style',
    negativePrompt: 'photograph, realistic, 3D, dark, gritty, complex textures',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
    thumbnailUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'builtin_oil_painting',
    name: 'Vintage Oil Painting',
    familyId: 'painting',
    tag: 'Museum Impasto Canvas',
    stylePrompt:
      'Rich oil painting, impressionist style, visible brushstrokes, warm golden palette, old masters technique, museum quality fine art',
    negativePrompt: 'digital art, photograph, anime, flat design, neon, modern',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
  },
];

// ─── Style Preset CRUD Accessors ──────────────────────────────────────────────

let cachedApiStyles: BaseStylePreset[] | null = null;
let lastApiFetchTime = 0;

/** Fetch live art styles from /api/styles with 60-second in-memory cache */
export async function fetchLiveArtStyles(): Promise<BaseStylePreset[] | null> {
  const now = Date.now();
  if (cachedApiStyles && now - lastApiFetchTime < 60000) {
    return cachedApiStyles;
  }
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/styles');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.styles) && data.styles.length > 0) {
          cachedApiStyles = data.styles;
          lastApiFetchTime = now;
          return cachedApiStyles;
        }
      }
    }
  } catch (err) {
    console.warn('[store] fetchLiveArtStyles fallback:', err);
  }
  return null;
}

// ─── Local Storage Sync for Admin Art Styles ───────────────────────────────────

export function getAdminArtStyles(): BaseStylePreset[] {
  return storeGet<BaseStylePreset[]>('admin-art-styles') || [];
}

export function saveAdminArtStyle(style: BaseStylePreset): void {
  const current = getAdminArtStyles();
  const idx = current.findIndex((s) => s.id === style.id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...style };
  } else {
    current.unshift(style);
  }
  storeSet('admin-art-styles', current);
}

export function deleteAdminArtStyle(id: string): void {
  const current = getAdminArtStyles();
  storeSet('admin-art-styles', current.filter((s) => s.id !== id));
}

export async function getStylePresets(): Promise<BaseStylePreset[]> {
  const custom = storeGet<BaseStylePreset[]>('style-presets') || [];
  const adminStyles = getAdminArtStyles();
  const liveStyles = await fetchLiveArtStyles();
  const baseList = liveStyles && liveStyles.length > 0 ? liveStyles : BUILT_IN_STYLE_PRESETS;
  
  // Merge admin overrides over baseList
  const adminMap = new Map(adminStyles.map((s) => [s.id, s]));
  const mergedBase = baseList.map((s) => adminMap.get(s.id) || s);
  
  // Include newly added admin styles not in baseList
  const baseIds = new Set(baseList.map((s) => s.id));
  const newAdminStyles = adminStyles.filter((s) => !baseIds.has(s.id));

  const allSystem = [...mergedBase, ...newAdminStyles];
  const systemIds = new Set(allSystem.map((p) => p.id));
  const merged = [
    ...allSystem,
    ...custom.filter((p) => !systemIds.has(p.id)),
  ];

  return merged;
}

export async function saveStylePreset(preset: BaseStylePreset): Promise<void> {
  const custom = storeGet<BaseStylePreset[]>('style-presets') || [];
  const idx = custom.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    custom[idx] = preset;
  } else {
    custom.push(preset);
  }
  storeSet('style-presets', custom);
}

export async function deleteStylePreset(id: string): Promise<void> {
  const custom = storeGet<BaseStylePreset[]>('style-presets') || [];
  storeSet('style-presets', custom.filter((p) => p.id !== id));
}

export async function setDefaultStylePreset(id: string): Promise<void> {
  const custom = storeGet<BaseStylePreset[]>('style-presets') || [];
  const updated = custom.map((p) => ({ ...p, isDefault: p.id === id }));
  storeSet('style-presets', updated);
}

export const DEFAULT_BASE_STYLE_PROMPT =
  'Photorealistic, cinematic lighting, 8k resolution, muted color palette, high-end documentary look, shot on 35mm anamorphic lens, dramatic shadows, film grain';

export const DEFAULT_NEGATIVE_PROMPT =
  'cartoon, anime, blurry, distorted faces, low resolution, CGI, oversaturated, watermark, text, signature';

export async function getGlobalBaseStylePrompt(): Promise<string> {
  return storeGet<string>('global-base-style-prompt') || DEFAULT_BASE_STYLE_PROMPT;
}

export async function saveGlobalBaseStylePrompt(prompt: string): Promise<void> {
  storeSet('global-base-style-prompt', prompt);
}

export async function getGlobalNegativePrompt(): Promise<string> {
  return storeGet<string>('global-negative-prompt') || DEFAULT_NEGATIVE_PROMPT;
}

export async function saveGlobalNegativePrompt(prompt: string): Promise<void> {
  storeSet('global-negative-prompt', prompt);
}

export async function getDefaultStylePreset(): Promise<BaseStylePreset> {
  const all = await getStylePresets();
  return all.find((p) => p.isDefault) ?? all[0] ?? BUILT_IN_STYLE_PRESETS[0];
}
