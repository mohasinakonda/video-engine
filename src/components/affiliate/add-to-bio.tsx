'use client';

/**
 * Add a product from Affiliate Intelligence to the creator's bio page: pick one of its Amazon
 * photos, edit the title, choose a category (or none) and tags. With no store yet, the handle is
 * picked here first. If the ASIN is already in the store, only the new tags are added.
 */
import { useEffect, useId, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { CreateStore } from '@/components/store/create-store';
import { ProductFields, TagInput, type ProductDraft } from '@/components/store/fields';
import type { ProductDetails, RankedProduct } from '@/lib/affiliate/types';
import type { Store, StoreProduct } from '@/lib/store/repo';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

interface Props {
  product: RankedProduct;
  details: ProductDetails | null;
  store: Store | null;
  categories: string[];
  bioBaseUrl: string;
  /** Tags to start with, e.g. the video's tag. */
  defaultTags?: string[];
  onStoreCreated: (s: Store) => void;
  onClose: () => void;
  onAdded: (p: StoreProduct, existed: boolean) => void;
}

export function AddToBioModal(props: Props) {
  const { product, details, store } = props;
  const titleId = useId();
  const images = details?.images.length ? details.images : product.imageUrl ? [product.imageUrl] : [];
  const [draft, setDraft] = useState<ProductDraft>({
    asin: product.asin,
    name: (details?.title || product.title).slice(0, 200),
    imageUrl: images[0] ?? '',
    category: '',
    tags: props.defaultTags ?? [],
    blurb: '',
    show: true,
  });
  const [existing, setExisting] = useState<StoreProduct | null | undefined>(store ? undefined : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  // Is it already in the store? Then only tags are added.
  useEffect(() => {
    if (!store) return;
    api<{ products: StoreProduct[] }>(`/api/store/products?asin=${product.asin}`)
      .then((d) => setExisting(d.products[0] ?? null))
      .catch(() => setExisting(null));
  }, [store, product.asin]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        asin: product.asin,
        name: draft.name,
        imageUrl: draft.imageUrl.trim() || null,
        images: images.slice(0, 20),
        source: 'canopy',
        category: draft.category || null,
        tags: draft.tags,
        blurb: draft.blurb,
      };
      const { product: saved, existed } = await api<{ product: StoreProduct; existed: boolean }>('/api/store/products', { method: 'POST', body: JSON.stringify(body) });
      if (!existed && !draft.show) await api(`/api/store/products/${saved.id}`, { method: 'PATCH', body: JSON.stringify({ show: false }) });
      props.onAdded(saved, existed);
      setDone(existed ? 'Tags added to the product already on your page.' : 'Added to your bio page.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto p-5" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-white">
              Add to my bio
            </h2>
            {store && (
              <p className="text-xs text-zinc-500">
                {props.bioBaseUrl.replace(/^https:\/\//, '').replace(/\/$/, '')}/@{store.handle}
              </p>
            )}
          </div>
          <button type="button" className="btn-ghost btn-sm" aria-label="Close" onClick={props.onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {!store ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">First, pick a handle for your bio page. Then this product goes on it.</p>
            <CreateStore bare bioBaseUrl={props.bioBaseUrl} onCreated={props.onStoreCreated} />
          </div>
        ) : done ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <Check size={16} aria-hidden="true" /> {done}
            </p>
            <div className="flex justify-end gap-2">
              <a href={`${props.bioBaseUrl.replace(/\/$/, '')}/@${store.handle}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                View my page
              </a>
              <button type="button" className="btn-primary" onClick={props.onClose}>
                Done
              </button>
            </div>
          </div>
        ) : existing === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-zinc-400" aria-label="Loading" />
          </div>
        ) : (
          <>
            {existing ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-300">
                  “{existing.name}” is already on your page. Only new tags will be added
                  {existing.tags.length ? ` (it has: ${existing.tags.join(', ')})` : ''}.
                </p>
                <TagInput value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
              </div>
            ) : (
              <ProductFields draft={draft} onChange={setDraft} categories={props.categories} canUpload={store.hasImagekitPrivateKey} asinEditable={false} imageChoices={images} />
            )}
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={props.onClose}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={saving || !draft.name.trim() || (Boolean(existing) && draft.tags.length === 0)} onClick={save}>
                {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} {existing ? 'Add tags' : 'Add to my bio'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
