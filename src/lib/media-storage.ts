/**
 * media-storage.ts — Persistent IndexedDB media store for browser mode
 *
 * Stores generated audio chunks and scene images as Blobs in IndexedDB
 * so they persist across page refreshes, routes, and browser restarts.
 */

import type { ProjectManifest } from '@/types';

const DB_NAME = 'ai_video_studio_media';
const DB_VERSION = 2;
const STORE_NAME = 'media_blobs';
const STORE_PROJECTS = 'projects_manifests';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'projectId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a ProjectManifest to persistent IndexedDB (no 5MB quota limit) */
export async function saveProjectToDB(manifest: ProjectManifest): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.put(manifest);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save project manifest to IndexedDB:', err);
  }
}

/** Retrieve a stored ProjectManifest from IndexedDB */
export async function getProjectFromDB(projectId: string): Promise<ProjectManifest | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.get(projectId);
      req.onsuccess = () => resolve((req.result as ProjectManifest) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Retrieve all ProjectManifests from IndexedDB */
export async function getAllProjectsFromDB(): Promise<ProjectManifest[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as ProjectManifest[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Delete a ProjectManifest from IndexedDB */
export async function deleteProjectFromDB(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.delete(projectId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete project from IndexedDB:', err);
  }
}

/** Save a binary Blob (audio WAV/MP3, scene JPEG/PNG) to persistent IndexedDB */
export async function saveMediaBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save media blob to IndexedDB:', err);
  }
}

/** Retrieve a stored Blob from IndexedDB */
export async function getMediaBlob(key: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Retrieve a stored Blob and return a live browser URL */
export async function getMediaBlobUrl(key: string): Promise<string | null> {
  const blob = await getMediaBlob(key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/** Remove a stored Blob from IndexedDB */
export async function deleteMediaBlob(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete media blob from IndexedDB:', err);
  }
}

/**
 * Accurately determines audio duration (in seconds) for any audio Blob/File
 * using HTML5 Audio element with fallback to Web Audio API AudioContext.
 */
export async function getAudioDuration(blob: Blob | File): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(0);
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanUp = () => {
      URL.revokeObjectURL(url);
    };

    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      cleanUp();
      if (typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0) {
        resolve(dur);
      } else {
        decodeViaAudioContext(blob).then(resolve).catch(reject);
      }
    };

    audio.onerror = () => {
      cleanUp();
      decodeViaAudioContext(blob).then(resolve).catch(reject);
    };

    audio.src = url;
  });
}

async function decodeViaAudioContext(blob: Blob | File): Promise<number> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error('AudioContext not supported');
  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return audioBuf.duration;
  } finally {
    ctx.close().catch(() => {});
  }
}

/** Purge all media blobs (scenes, audio) belonging to a specific project from IndexedDB */
export async function deleteProjectMedia(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const key = String(cursor.key);
          if (key.includes(projectId)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Failed to delete project media blobs from IndexedDB:', err);
  }
}

/** Get estimated disk storage used by IndexedDB */
export async function getStorageEstimate(): Promise<{ usedMB: number; quotaMB: number }> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return {
        usedMB: Math.round(usage / (1024 * 1024)),
        quotaMB: Math.round(quota / (1024 * 1024)),
      };
    } catch {
      return { usedMB: 0, quotaMB: 0 };
    }
  }
  return { usedMB: 0, quotaMB: 0 };
}

