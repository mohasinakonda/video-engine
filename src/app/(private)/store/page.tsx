'use client';

import { Dispatch, SetStateAction, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, EyeOff, Loader2, Pencil, Plus, Search, Store as StoreIcon, Trash2, X } from 'lucide-react';
import { CreateStore } from '@/components/store/create-store';
import { ProductFields, emptyDraft, type ProductDraft } from '@/components/store/fields';
import type { Store, StoreLink, StoreProduct } from '@/lib/store/repo';
import { MARKETPLACES, asinFrom } from '@/lib/store/validation';

type Tab = 'products' | 'add' | 'settings';
interface Config {
  enabled: boolean;
  hasAccess: boolean;
  bioBaseUrl: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

export default function StorePage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [store, setStore] = useState<Store | null | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('products');
  const [editProduct, setEditProduct] = useState<StoreProduct | null>(null);

  const load = useCallback(async () => {
    try {
      const [cfg, data] = await Promise.all([api<Config>('/api/affiliate/config'), api<{ store: Store | null; categories: string[] }>('/api/store')]);
      setConfig(cfg);
      setStore(data.store);
      setCategories(data.categories);
    } catch (err) {
      setError((err as Error).message);
      setStore(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const bioUrl = store && config ? `${config.bioBaseUrl.replace(/\/$/, '')}/@${store.handle}` : null;

  return (
    <>
      <div className="page-shell">
        <div className="page-container max-w-5xl space-y-5">
          <header className="page-header flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <StoreIcon size={24} aria-hidden="true" /> Store
              </h1>
              <p className="page-subtitle">The products on your link-in-bio page.</p>
            </div>
            {bioUrl && (
              <a href={bioUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                {bioUrl.replace(/^https:\/\//, '')} <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </header>

          {store === undefined ? (
            <div className="card flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-400" aria-label="Loading" />
            </div>
          ) : error && !store ? (
            <div className="card text-sm text-zinc-300">{error}</div>
          ) : !store ? (
            <CreateStore onCreated={(s) => setStore(s)} bioBaseUrl={config?.bioBaseUrl ?? 'https://bio.rendoza.com'} />
          ) : (
            <>
              <div className="inline-flex gap-1 rounded-xl border border-bg-border bg-bg-elevated p-1" role="tablist" aria-label="Store">
                {(
                  [
                    ['products', 'Products'],
                    ['add', 'Add product'],
                    ['settings', 'Settings'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'products' && <Products
                store={store} onCategories={setCategories} categories={categories} setEditProduct={setEditProduct} />}
              {tab === 'add' && (
                <AddProduct
                  store={store}
                  categories={categories}
                  onAdded={() => {
                    load();
                    setTab('products');
                  }}
                />
              )}
              {tab === 'settings' && <Settings store={store} onSaved={setStore} />}
            </>
          )}
        </div>
      </div>

      {editProduct && (
        <EditProduct
          product={editProduct}
          store={store!}
          categories={categories}
          onClose={() => setEditProduct(null)}
          refetch={load}
          onSaved={(product) => {
            setEditProduct(product)
          }}
        />
      )}
    </>
  );
}

// ─── Products ────────────────────────────────────────────────────────────────

const draftOf = (p: StoreProduct): ProductDraft => ({
  asin: p.asin,
  name: p.name,
  imageUrl: p.imageUrl ?? '',
  category: p.category ?? '',
  tags: p.tags,
  blurb: p.blurb ?? '',
  show: p.show,
});

function Products({ store, categories, onCategories, setEditProduct }: { store: Store; categories: string[]; onCategories: (c: string[]) => void, setEditProduct: Dispatch<SetStateAction<StoreProduct | null>> }) {
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [cat, setCat] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [allTags, setAllTags] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ q, tag, cat });
      const data = await api<{ products: StoreProduct[]; categories: string[] }>(`/api/store/products?${params}`);
      setProducts(data.products);
      onCategories(data.categories);
      if (!q && !tag && !cat) setAllTags(Array.from(new Set(data.products.flatMap((p) => p.tags))).sort());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [q, tag, cat, onCategories]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const patch = async (p: StoreProduct, body: Partial<Record<string, unknown>>) => {
    try {
      const { product } = await api<{ product: StoreProduct }>(`/api/store/products/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setProducts((list) => list?.map((x) => (x.id === product.id ? product : x)) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (p: StoreProduct) => {
    if (!window.confirm(`Remove “${p.name}” from your store?`)) return;
    try {
      await api(`/api/store/products/${p.id}`, { method: 'DELETE' });
      setProducts((list) => list?.filter((x) => x.id !== p.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Moving needs distinct positions: number the whole list first when two share one.
  const move = async (index: number, dir: -1 | 1) => {
    if (!products) return;
    const j = index + dir;
    if (j < 0 || j >= products.length) return;
    const list = [...products];
    [list[index], list[j]] = [list[j], list[index]];
    setProducts(list);
    const updates = list.map((p, i) => ({ p, order: i * 10 })).filter(({ p, order }) => p.sortOrder !== order);
    await Promise.all(updates.map(({ p, order }) => patch(p, { sortOrder: order })));
    load();
  };

  const filtered = Boolean(q || tag || cat);
  return (
    <>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-lg border border-bg-border bg-bg-base px-3">
            <Search size={16} className="text-zinc-500" aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input
              className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, category or tag"
            />
          </label>
          <select className="input w-auto" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag">
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {!products ? (
          <div className="card flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-zinc-400" aria-label="Loading" />
          </div>
        ) : products.length === 0 ? (
          <div className="card text-sm text-zinc-400">{filtered ? 'No product matches.' : 'No products yet. Add one by hand, or from Affiliate Intelligence.'}</div>
        ) : (
          <ul className="card divide-y divide-bg-border p-0">
            {products.map((p, i) => (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 p-3 ${p.show ? '' : 'opacity-60'}`}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] text-zinc-500">No image</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-xs text-zinc-500">
                    {p.asin}
                    {p.category ? ` · ${p.category}` : ''}
                    {p.show ? '' : ' · hidden'}
                  </p>
                  {p.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <button key={t} type="button" onClick={() => setTag(t)} className="rounded bg-bg-elevated px-1.5 py-0.5 text-[11px] text-zinc-300 hover:text-white">
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!filtered && (
                    <>
                      <button type="button" className="btn-ghost btn-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-ghost btn-sm" aria-label="Move down" disabled={i === products.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown size={14} aria-hidden="true" />
                      </button>
                    </>
                  )}
                  <button type="button" className="btn-ghost btn-sm" aria-label={p.show ? 'Hide from bio page' : 'Show on bio page'} onClick={() => patch(p, { show: !p.show })}>
                    {p.show ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" aria-label="Edit" onClick={() => setEditProduct(p)}>
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-ghost btn-sm" aria-label="Remove" onClick={() => remove(p)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

      </section>


    </>

  );
}


type EditPros = {
  refetch: VoidFunction
  product: StoreProduct;
  store: Store;
  categories: string[];
  onClose: () => void;
  onSaved: (p: StoreProduct) => void
}
function EditProduct({ refetch, product: p, store, categories, onClose, onSaved }: EditPros) {
  const [draft, setDraft] = useState(draftOf(p));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  // useEffect(() => {
  //   const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
  //   window.addEventListener('keydown', onKey);
  //   return () => window.removeEventListener('keydown', onKey);
  // }, [props]);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { product } = await api<{ product: StoreProduct }>(`/api/store/products/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          imageUrl: draft.imageUrl.trim() || null,
          category: draft.category || null,
          tags: draft.tags,
          blurb: draft.blurb,
          show: draft.show,
        }),
      });
      onSaved(product);
      refetch()
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);

      onClose()
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose} >
      <div className="modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto p-5" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-white">
            Edit product
          </h2>
          <button type="button" className="btn-ghost btn-sm" aria-label="Close" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="mb-3 text-xs text-zinc-500">ASIN {p.asin}</p>
        <ProductFields draft={draft} onChange={setDraft} categories={categories} canUpload={store.hasImagekitPrivateKey} asinEditable={false} />
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving || !draft.name.trim()} onClick={save}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add ─────────────────────────────────────────────────────────────────────

function AddProduct({ store, categories, onAdded }: { store: Store; categories: string[]; onAdded: () => void }) {
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const asin = useMemo(() => asinFrom(draft.asin), [draft.asin]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = { asin, name: draft.name, imageUrl: draft.imageUrl.trim() || null, source: 'manual', category: draft.category || null, tags: draft.tags, blurb: draft.blurb };
      const { product, existed } = await api<{ product: StoreProduct; existed: boolean }>('/api/store/products', { method: 'POST', body: JSON.stringify(body) });
      if (!existed && !draft.show) await api(`/api/store/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ show: false }) });
      if (existed) {
        setNotice(`“${product.name}” was already in your store: the new tags were added.`);
        setDraft(emptyDraft());
        return;
      }
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Add a product by hand</h2>
        <p className="text-sm text-zinc-400">
          Paste the Amazon link or ASIN. If it’s already in your store, only the new tags are added.
          {!store.hasImagekitPrivateKey && ' To upload images, add your ImageKit keys in Settings; or paste an image link.'}
        </p>
      </div>
      <ProductFields draft={draft} onChange={setDraft} categories={categories} canUpload={store.hasImagekitPrivateKey} asinEditable />
      {draft.asin && !asin && <p className="text-xs text-rose-300">That isn’t an ASIN or an Amazon product link.</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {notice && (
        <p className="flex items-center gap-2 text-sm text-emerald-300">
          <Check size={14} aria-hidden="true" /> {notice}
        </p>
      )}
      <button type="button" className="btn-primary" disabled={saving || !asin || !draft.name.trim()} onClick={save}>
        {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Add to my store
      </button>
    </section>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

function Settings({ store, onSaved }: { store: Store; onSaved: (s: Store) => void }) {
  const [form, setForm] = useState({
    displayName: store.displayName,
    bio: store.bio ?? '',
    avatarUrl: store.avatarUrl ?? '',
    marketplace: store.marketplace,
    amazonTag: store.amazonTag ?? '',
    links: store.links as StoreLink[],
    imagekitUrlEndpoint: store.imagekitUrlEndpoint ?? '',
    imagekitPublicKey: store.imagekitPublicKey ?? '',
  });
  const [privateKey, setPrivateKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const id = useId();

  const save = async (extra: { imagekitPrivateKey?: string } = {}) => {
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        ...form,
        bio: form.bio,
        avatarUrl: form.avatarUrl.trim() || null,
        links: form.links.filter((l) => l.label.trim() && l.url.trim()),
        ...(privateKey ? { imagekitPrivateKey: privateKey } : {}),
        ...extra,
      };
      const { store: saved } = await api<{ store: Store }>('/api/store', { method: 'PATCH', body: JSON.stringify(body) });
      onSaved(saved);
      setPrivateKey('');
      setMessage({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string) => `${id}-${key}`;
  return (
    <section className="space-y-5">
      <div className="card max-w-2xl space-y-4">
        <h2 className="text-lg font-bold text-white">Profile</h2>
        <div>
          <p className="label">Handle</p>
          <p className="text-sm text-zinc-300">@{store.handle}</p>
          <p className="text-xs text-zinc-500">Handles can’t be changed yet.</p>
        </div>
        <div>
          <label className="label" htmlFor={field('name')}>
            Display name
          </label>
          <input id={field('name')} className="input w-full" value={form.displayName} maxLength={60} onChange={(e) => set('displayName', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={field('bio')}>
            Bio
          </label>
          <textarea id={field('bio')} className="input min-h-[72px] w-full" value={form.bio} maxLength={300} onChange={(e) => set('bio', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={field('avatar')}>
            Profile picture link
          </label>
          <input id={field('avatar')} className="input w-full" type="url" value={form.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} placeholder="https://…" />
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Links (up to 5, shown above your products)</legend>
          {form.links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input w-40"
                aria-label={`Link ${i + 1} label`}
                value={l.label}
                maxLength={40}
                onChange={(e) =>
                  set(
                    'links',
                    form.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                placeholder="YouTube"
              />
              <input
                className="input flex-1"
                aria-label={`Link ${i + 1} address`}
                type="url"
                value={l.url}
                onChange={(e) =>
                  set(
                    'links',
                    form.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  )
                }
                placeholder="https://…"
              />
              <button
                type="button"
                className="btn-ghost btn-sm"
                aria-label={`Remove link ${i + 1}`}
                onClick={() =>
                  set(
                    'links',
                    form.links.filter((_, j) => j !== i),
                  )
                }
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          {form.links.length < 5 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => set('links', [...form.links, { label: '', url: '' }])}>
              <Plus size={14} aria-hidden="true" /> Add a link
            </button>
          )}
        </fieldset>
      </div>

      <div className="card max-w-2xl space-y-4">
        <h2 className="text-lg font-bold text-white">Amazon</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={field('market')}>
              Marketplace
            </label>
            <select id={field('market')} className="input w-full" value={form.marketplace} onChange={(e) => set('marketplace', e.target.value as Store['marketplace'])}>
              {MARKETPLACES.map((m) => (
                <option key={m} value={m}>
                  Amazon {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={field('tag')}>
              Associates store ID
            </label>
            <input id={field('tag')} className="input w-full" value={form.amazonTag} onChange={(e) => set('amazonTag', e.target.value)} placeholder="mychannel-20" />
          </div>
        </div>
        <p className="text-xs text-zinc-500">Every “View on Amazon” link on your page carries this ID, so purchases count for you.</p>
      </div>

      <div className="card max-w-2xl space-y-4">
        <h2 className="text-lg font-bold text-white">ImageKit (optional)</h2>
        <p className="text-sm text-zinc-400">To upload your own product photos. Without it, paste image links.</p>
        <div>
          <label className="label" htmlFor={field('ikurl')}>
            URL endpoint
          </label>
          <input
            id={field('ikurl')}
            className="input w-full"
            value={form.imagekitUrlEndpoint}
            onChange={(e) => set('imagekitUrlEndpoint', e.target.value)}
            placeholder="https://ik.imagekit.io/your_id"
          />
        </div>
        <div>
          <label className="label" htmlFor={field('ikpub')}>
            Public key
          </label>
          <input id={field('ikpub')} className="input w-full" value={form.imagekitPublicKey} onChange={(e) => set('imagekitPublicKey', e.target.value)} placeholder="public_…" />
        </div>
        <div>
          <label className="label" htmlFor={field('ikpriv')}>
            Private key
          </label>
          <input
            id={field('ikpriv')}
            className="input w-full"
            type="password"
            autoComplete="off"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder={store.hasImagekitPrivateKey ? 'Saved. Type a new one to replace it.' : 'private_…'}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Stored encrypted and never shown again.
            {store.hasImagekitPrivateKey && (
              <>
                {' '}
                <button type="button" className="underline hover:text-white" onClick={() => save({ imagekitPrivateKey: '' })}>
                  Remove it
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={saving || !form.displayName.trim()} onClick={() => save()}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Save settings
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-rose-300'}`} aria-live="polite">
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
