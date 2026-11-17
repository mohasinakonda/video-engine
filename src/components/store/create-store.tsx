'use client';

/** Pick a handle and a display name: the creator's bio page (bio.rendoza.com/@handle). Used by the Store and the Add to bio modal. */
import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Store } from '@/lib/store/repo';
import { handleProblem, normalizeHandle } from '@/lib/store/validation';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

export function CreateStore({ onCreated, bioBaseUrl, bare = false }: { onCreated: (s: Store) => void; bioBaseUrl: string; bare?: boolean }) {
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [check, setCheck] = useState<{ handle: string; available: boolean; problem: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { handle: useId(), name: useId() };
  const h = normalizeHandle(handle);
  const local = h ? handleProblem(h) : null;

  useEffect(() => {
    if (!h || local) {
      setCheck(null);
      return;
    }
    const t = setTimeout(() => {
      api<{ handle: string; available: boolean; problem: string | null }>(`/api/store/handle?h=${encodeURIComponent(h)}`)
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 350);
    return () => clearTimeout(t);
  }, [h, local]);

  const ok = check?.handle === h && check.available;
  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const { store } = await api<{ store: Store }>('/api/store', { method: 'POST', body: JSON.stringify({ handle: h, displayName: name }) });
      onCreated(store);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`space-y-4 ${bare ? '' : 'card max-w-xl'}`}>
      <div>
        <h2 className="text-lg font-bold text-white">Create your bio page</h2>
        <p className="text-sm text-zinc-400">Pick a handle. It can’t be changed later, so choose the name your viewers know you by.</p>
      </div>
      <div>
        <label className="label" htmlFor={ids.handle}>
          Handle
        </label>
        <div className="flex items-center rounded-lg border border-bg-border bg-bg-base pl-3">
          <span className="text-sm text-zinc-500">{bioBaseUrl.replace(/^https:\/\//, '').replace(/\/$/, '')}/@</span>
          <input
            id={ids.handle}
            className="flex-1 bg-transparent px-1 py-2.5 text-sm text-white outline-none"
            value={handle}
            maxLength={31}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <p className={`mt-1 text-xs ${local || (check && !check.available) ? 'text-rose-300' : ok ? 'text-emerald-300' : 'text-zinc-500'}`} aria-live="polite">
          {local ?? (check?.handle === h ? (check.available ? 'Available' : check.problem) : h ? 'Checking…' : '3–30 letters, numbers, dots or underscores')}
        </p>
      </div>
      <div>
        <label className="label" htmlFor={ids.name}>
          Display name
        </label>
        <input id={ids.name} className="input w-full" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Detail Dose" />
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button type="button" className="btn-primary" disabled={!ok || !name.trim() || saving} onClick={create}>
        {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Create my page
      </button>
    </section>
  );
}
