/**
 * store.ts — Tauri plugin-store accessors
 *
 * Wraps @tauri-apps/plugin-store for all persistent data:
 *  - Gemini API key
 *  - Voice presets
 *  - Project manifests
 *
 * In development (non-Tauri context), falls back to localStorage.
 */

import type { VoicePreset, ProjectManifest } from '@/types';

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
