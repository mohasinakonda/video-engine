/**
 * store.ts — Tauri plugin-store accessors
 *
 * Wraps @tauri-apps/plugin-store for all persistent data:
 *  - Gemini API key
 *  - Voice presets
 *  - Project manifests
 *  - Base Style Presets (Phase 2)
 *
 * In development (non-Tauri context), falls back to localStorage.
 */

import type { VoicePreset, ProjectManifest, BaseStylePreset } from '@/types';

// ─── Tauri Detection ──────────────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ─── Generic Store Helpers ────────────────────────────────────────────────────

async function storeGet<T>(store: unknown, key: string): Promise<T | null> {
  if (isTauri()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = store as any;
    return s.get(key) as Promise<T | null>;
  }

  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

async function storeSet(store: unknown, key: string, value: unknown): Promise<void> {
  if (isTauri()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (store as any).set(key, value);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (store as any).save();
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

// ─── Store Instances ──────────────────────────────────────────────────────────

let _settingsStore: unknown = null;
let _presetsStore: unknown = null;
let _projectsStore: unknown = null;
let _stylePresetsStore: unknown = null;

async function getSettingsStore() {
  if (!isTauri()) return null;
  if (!_settingsStore) {
    const { Store } = await import('@tauri-apps/plugin-store');
    _settingsStore = await Store.load('settings.json', { autoSave: true });
  }
  return _settingsStore;
}

async function getPresetsStore() {
  if (!isTauri()) return null;
  if (!_presetsStore) {
    const { Store } = await import('@tauri-apps/plugin-store');
    _presetsStore = await Store.load('presets.json', { autoSave: true });
  }
  return _presetsStore;
}

async function getProjectsStore() {
  if (!isTauri()) return null;
  if (!_projectsStore) {
    const { Store } = await import('@tauri-apps/plugin-store');
    _projectsStore = await Store.load('projects.json', { autoSave: true });
  }
  return _projectsStore;
}

async function getStylePresetsStore() {
  if (!isTauri()) return null;
  if (!_stylePresetsStore) {
    const { Store } = await import('@tauri-apps/plugin-store');
    _stylePresetsStore = await Store.load('style-presets.json', { autoSave: true });
  }
  return _stylePresetsStore;
}

// ─── API Key ──────────────────────────────────────────────────────────────────

export async function getApiKey(): Promise<string> {
  const store = await getSettingsStore();
  const key = await storeGet<string>(store, 'gemini-api-key');
  return key ?? '';
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const store = await getSettingsStore();
  await storeSet(store, 'gemini-api-key', apiKey);
}

export async function getPollinationsApiKey(): Promise<string> {
  const store = await getSettingsStore();
  const key = await storeGet<string>(store, 'pollinations-api-key');
  return key ?? '';
}

export async function savePollinationsApiKey(apiKey: string): Promise<void> {
  const store = await getSettingsStore();
  await storeSet(store, 'pollinations-api-key', apiKey);
}

export async function getPollinationsImageModel(): Promise<string> {
  const store = await getSettingsStore();
  const model = await storeGet<string>(store, 'pollinations-image-model');
  return model ?? 'flux';
}

export async function savePollinationsImageModel(model: string): Promise<void> {
  const store = await getSettingsStore();
  await storeSet(store, 'pollinations-image-model', model);
}

// ─── Voice Presets ────────────────────────────────────────────────────────────

export async function getPresets(): Promise<VoicePreset[]> {
  const store = await getPresetsStore();
  const presets = await storeGet<VoicePreset[]>(store, 'voice-presets');
  return presets ?? [];
}

export async function savePreset(preset: VoicePreset): Promise<void> {
  const presets = await getPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    presets[idx] = preset;
  } else {
    presets.push(preset);
  }
  const store = await getPresetsStore();
  await storeSet(store, 'voice-presets', presets);
}

export async function deletePreset(id: string): Promise<void> {
  const presets = await getPresets();
  const store = await getPresetsStore();
  await storeSet(store, 'voice-presets', presets.filter((p) => p.id !== id));
}

export async function setDefaultPreset(id: string): Promise<void> {
  const presets = await getPresets();
  const updated = presets.map((p) => ({ ...p, isDefault: p.id === id }));
  const store = await getPresetsStore();
  await storeSet(store, 'voice-presets', updated);
}

export async function getDefaultPreset(): Promise<VoicePreset | null> {
  const presets = await getPresets();
  return presets.find((p) => p.isDefault) ?? presets[0] ?? null;
}

// ─── Project Manifests ────────────────────────────────────────────────────────

export async function getAllProjects(): Promise<ProjectManifest[]> {
  const store = await getProjectsStore();
  const projects = await storeGet<ProjectManifest[]>(store, 'projects');
  return (projects ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
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
  const store = await getProjectsStore();
  await storeSet(store, 'projects', projects);
}

export async function deleteProject(projectId: string): Promise<void> {
  const projects = await getAllProjects();
  const store = await getProjectsStore();
  await storeSet(
    store,
    'projects',
    projects.filter((p) => p.projectId !== projectId)
  );
}

// ─── Phase 2: Built-in Style Presets ──────────────────────────────────────────

export const BUILT_IN_STYLE_PRESETS: BaseStylePreset[] = [
  {
    id: 'builtin_cinematic',
    name: 'Dark Cinematic Documentary',
    stylePrompt:
      'Photorealistic, cinematic lighting, 8k resolution, muted color palette, high-end documentary look, shot on 35mm anamorphic lens, dramatic shadows, film grain',
    negativePrompt: 'cartoon, anime, blurry, distorted faces, low resolution, CGI, oversaturated',
    aspectRatio: '16:9',
    isDefault: true,
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

// ─── Phase 2: Style Preset CRUD ───────────────────────────────────────────────

export async function getStylePresets(): Promise<BaseStylePreset[]> {
  const store = await getStylePresetsStore();
  const custom = await storeGet<BaseStylePreset[]>(store, 'style-presets');
  // Merge built-ins (first) + custom presets, deduplicating by id
  const customList = custom ?? [];
  const allIds = new Set(customList.map((p) => p.id));
  const merged = [
    ...BUILT_IN_STYLE_PRESETS.filter((p) => !allIds.has(p.id)),
    ...customList,
  ];

  // Inject global base style prompt into default preset if customized
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
  // Only save non-built-in presets to the store
  const store = await getStylePresetsStore();
  const custom = await storeGet<BaseStylePreset[]>(store, 'style-presets') ?? [];
  const idx = custom.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    custom[idx] = preset;
  } else {
    custom.push(preset);
  }
  await storeSet(store, 'style-presets', custom);
}

export async function deleteStylePreset(id: string): Promise<void> {
  const store = await getStylePresetsStore();
  const custom = await storeGet<BaseStylePreset[]>(store, 'style-presets') ?? [];
  await storeSet(store, 'style-presets', custom.filter((p) => p.id !== id));
}

export async function setDefaultStylePreset(id: string): Promise<void> {
  // Update custom presets
  const store = await getStylePresetsStore();
  const custom = await storeGet<BaseStylePreset[]>(store, 'style-presets') ?? [];
  const updated = custom.map((p) => ({ ...p, isDefault: p.id === id }));
  await storeSet(store, 'style-presets', updated);
}

export const DEFAULT_BASE_STYLE_PROMPT =
  'Photorealistic, cinematic lighting, 8k resolution, muted color palette, high-end documentary look, shot on 35mm anamorphic lens, dramatic shadows, film grain';

export const DEFAULT_NEGATIVE_PROMPT =
  'cartoon, anime, blurry, distorted faces, low resolution, CGI, oversaturated, watermark, text, signature';

export async function getGlobalBaseStylePrompt(): Promise<string> {
  const store = await getSettingsStore();
  const prompt = await storeGet<string>(store, 'global-base-style-prompt');
  return prompt ?? DEFAULT_BASE_STYLE_PROMPT;
}

export async function saveGlobalBaseStylePrompt(prompt: string): Promise<void> {
  const store = await getSettingsStore();
  await storeSet(store, 'global-base-style-prompt', prompt);
}

export async function getGlobalNegativePrompt(): Promise<string> {
  const store = await getSettingsStore();
  const neg = await storeGet<string>(store, 'global-negative-prompt');
  return neg ?? DEFAULT_NEGATIVE_PROMPT;
}

export async function saveGlobalNegativePrompt(prompt: string): Promise<void> {
  const store = await getSettingsStore();
  await storeSet(store, 'global-negative-prompt', prompt);
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
