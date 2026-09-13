/**
 * media-storage.ts — Persistent IndexedDB media store for browser mode
 *
 * Stores generated audio chunks and scene images as Blobs in IndexedDB
 * so they persist across page refreshes, routes, and browser restarts.
 */

const DB_NAME = 'ai_video_studio_media';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
