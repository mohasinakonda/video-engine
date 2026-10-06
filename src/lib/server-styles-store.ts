import fs from 'fs/promises';
import path from 'path';
import type { BaseStylePreset } from '@/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'art-styles-override.json');

// In-memory cache for ultra-fast API responses
let memoryStyles: BaseStylePreset[] | null = null;

async function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory already exists
  }
}

export async function getFileStyles(): Promise<BaseStylePreset[]> {
  if (memoryStyles) return memoryStyles;

  try {
    await ensureDataDir();
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryStyles = parsed;
      return parsed;
    }
  } catch {
    // File doesn't exist yet
  }
  return [];
}

export async function saveStyleToFile(style: BaseStylePreset): Promise<void> {
  await ensureDataDir();
  const current = await getFileStyles();
  const idx = current.findIndex((s) => s.id === style.id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...style };
  } else {
    current.unshift(style);
  }
  memoryStyles = [...current];
  await fs.writeFile(DATA_FILE, JSON.stringify(current, null, 2), 'utf-8');
}

export async function toggleStyleInFile(id: string, isActive: boolean): Promise<void> {
  await ensureDataDir();
  const current = await getFileStyles();
  const idx = current.findIndex((s) => s.id === id);
  if (idx >= 0) {
    current[idx].isActive = isActive;
    memoryStyles = [...current];
    await fs.writeFile(DATA_FILE, JSON.stringify(current, null, 2), 'utf-8');
  }
}

export async function deleteStyleFromFile(id: string): Promise<void> {
  await ensureDataDir();
  const current = await getFileStyles();
  const updated = current.filter((s) => s.id !== id);
  memoryStyles = updated;
  await fs.writeFile(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
}
