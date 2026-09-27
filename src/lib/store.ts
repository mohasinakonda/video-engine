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

export async function getApiKey(): Promise<string> {
  return storeGet<string>('pollinations-api-key') || '';
}

export async function saveApiKey(apiKey: string): Promise<void> {
  storeSet('pollinations-api-key', apiKey);
}

export async function getPollinationsApiKey(): Promise<string> {
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
  if (idx >= 0) {
    projects[idx] = manifest;
  } else {
    projects.push(manifest);
  }
  storeSet('projects', projects);
}

export async function deleteProject(projectId: string): Promise<void> {
  const projects = await getAllProjects();
  storeSet('projects', projects.filter((p) => p.projectId !== projectId));
}

// ─── Phase 2: Built-in Style Presets ──────────────────────────────────────────

export const BUILT_IN_STYLE_PRESETS: BaseStylePreset[] = [
  {
    id: 'builtin_cinematic',
    name: 'Dark Cinematic Documentary',
    stylePrompt:
      'Cinematic 35mm anamorphic photography, photorealistic 8k ultra-detailed, dramatic chiaroscuro lighting, muted desaturated color grade, deep shadows with warm highlight accents, masterwork composition with rule-of-thirds framing, film grain texture, shallow depth of field, professional documentary cinematography, IMAX quality',
    negativePrompt: 'cartoon, anime, blurry, distorted faces, low resolution, CGI, oversaturated, watermark, text, flat illustration, modern UI elements',
    aspectRatio: '16:9',
    isDefault: true,
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin_artisan_linocut',
    name: 'Artisan Linocut Masterwork',
    stylePrompt:
      'Intricate masterwork linocut relief print by an artisan printmaker, deeply carved woodblock print style. Chiseled relief grooves, rough tactile ink press texture on fibrous cream archival paper, heavy contrasting black ink, sharp carved contours, rich hatching and crosshatching, master printmaking aesthetic, award-winning linoleum block art',
    negativePrompt: 'photorealism, 3D render, CGI, glossy digital illustration, smooth vector gradients, plastic textures, modern UI, neon colors, oversaturated, pure white background, blurry, text, watermark, bad anatomy, no modern graphics, no flat vectors',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin_conceptual_illustration',
    name: 'Conceptual Illustration',
    stylePrompt:
      'Conceptual illustration in a traditional hand-carved linocut and relief-print style printed on warm textured off-white archival paper (#F1E7D0). Hand-carved woodblock aesthetic with rough irregular carved edges, visible ink texture, coarse paper grain, organic cross-hatching, stippling and dot patterns, carved negative space details, and expressive silhouettes. Strict limited print palette: warm aged ivory cream paper, deep charcoal-green primary ink (#17251F), muted forest green (#486044), dusty sage olive (#718064), and muted terracotta peach sky (#D98267) with faded peach highlights (#E9B49A). Tonal transitions rendered exclusively via halftone dots, stippling, and carved line density without smooth digital gradients. Poetic visual metaphor and symbolic transformation connecting subject with landscape, layered rolling hills, foliage motifs, and hidden narrative details. Print-based chiaroscuro with strong silhouettes and exposed cream paper highlights. Subtle vintage aged paper border, museum-quality editorial relief art print',
    negativePrompt:
      'photorealism, 3D render, CGI, glossy digital illustration, smooth vector gradients, plastic textures, modern UI, neon colors, oversaturated, pure white, pure black, blurry, text, watermark, bad anatomy',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin_anime',
    name: 'Anime / Manga',
    stylePrompt:
      'High-quality anime illustration, detailed hand-drawn style, vibrant colors, clean linework, dramatic lighting, Studio Ghibli inspired',
    negativePrompt: 'realistic, photograph, 3D render, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin_cyberpunk',
    name: 'Cyberpunk Neon City',
    stylePrompt:
      'Futuristic cyberpunk aesthetic, neon lights, rain-slicked streets, ultra-detailed digital art, volumetric fog, holographic displays, blade runner inspired',
    negativePrompt: 'natural, daylight, countryside, low tech, sketch, watermark',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin_flat_vector',
    name: '2D Flat Vector',
    stylePrompt:
      'Modern 2D flat design illustration, bold clean shapes, minimal shadows, geometric forms, professional corporate explainer video style',
    negativePrompt: 'photograph, realistic, 3D, dark, gritty, complex textures',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin_oil_painting',
    name: 'Vintage Oil Painting',
    stylePrompt:
      'Rich oil painting, impressionist style, visible brushstrokes, warm golden palette, old masters technique, museum quality fine art',
    negativePrompt: 'digital art, photograph, anime, flat design, neon, modern',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 0,
  },
];

// ─── Style Preset CRUD Accessors ──────────────────────────────────────────────

export async function getStylePresets(): Promise<BaseStylePreset[]> {
  const custom = storeGet<BaseStylePreset[]>('style-presets') || [];
  const allIds = new Set(custom.map((p) => p.id));
  const merged = [
    ...BUILT_IN_STYLE_PRESETS.filter((p) => !allIds.has(p.id)),
    ...custom,
  ];

  const customPrompt = await getGlobalBaseStylePrompt();
  const customNeg = await getGlobalNegativePrompt();
  if (customPrompt && customPrompt.trim()) {
    return merged.map((p) => {
      if (p.isDefault || p.id === 'builtin_cinematic') {
        return {
          ...p,
          stylePrompt: customPrompt.trim(),
          negativePrompt: customNeg ? customNeg.trim() : p.negativePrompt,
        };
      }
      return p;
    });
  }

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
  const def = all.find((p) => p.isDefault) ?? all[0] ?? BUILT_IN_STYLE_PRESETS[0];

  const customPrompt = await getGlobalBaseStylePrompt();
  const customNeg = await getGlobalNegativePrompt();

  if (customPrompt && customPrompt.trim()) {
    return {
      ...def,
      stylePrompt: customPrompt.trim(),
      negativePrompt: customNeg ? customNeg.trim() : def.negativePrompt,
    };
  }

  return def;
}
