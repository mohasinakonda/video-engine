'use client';

/**
 * Affiliate Intelligence: pick a niche (or type a product), see the 10 best products for a review,
 * select up to 5 for a video, open one for its photos and features, and add any of them to the
 * bio page. The last search and the selection stay in this browser.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Clapperboard, ExternalLink, Loader2, Plus, PlusIcon, Search, ShoppingBag, Sparkles, Star, X } from 'lucide-react';
import { AddToBioModal } from '@/components/affiliate/add-to-bio';
import { MAX_SELECTED, api, detailsFromList, loadPack, loadSelection, saveSelection } from '@/components/affiliate/storage';
import type { SavedPack } from '@/components/affiliate/video-pack';
import { useAnalysisStream } from '@/components/youtube-doctor/use-diagnosis';
import { Skeleton, SkeletonBox } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { reportKey } from '@/lib/channel-doctor-storage';
import { DOMAINS, type Category, type Domain, type ProductDetails, type RankedProduct, type SearchResult } from '@/lib/affiliate/types';
import type { Store, StoreProduct } from '@/lib/store/repo';

type Stage = 'connect' | 'fetch' | 'rank' | 'done';
type SearchRequest =
  | { mode: 'bestsellers'; categoryId: string; categoryUrl?: string; categoryName: string; domain: Domain }
  | { mode: 'keyword'; term: string; domain: Domain; minPrice?: number; maxPrice?: number };

interface Config {
  enabled: boolean;
  hasAccess: boolean;
  costs: { search: number; video: number; seo: number };
  bioBaseUrl: string;
}

export default function AffiliatePage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [domain, setDomain] = useState<Domain>('US');
  const [term, setTerm] = useState('');
  const [request, setRequest] = useState<{ body: SearchRequest; nonce: number } | null>(null);
  const [selected, setSelected] = useState<RankedProduct[]>([]);
  const [focus, setFocus] = useState<RankedProduct | null>(null);
  const [details, setDetails] = useState<Record<string, ProductDetails | 'loading' | { error: string }>>({});
  const [store, setStore] = useState<Store | null | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);
  const [adding, setAdding] = useState<RankedProduct | null>(null);
  const [onBio, setOnBio] = useState<Set<string>>(new Set());
  // The last video pack: its tag goes on products added to the bio, and a card links to it.
  const [pack, setPack] = useState<SavedPack | null>(null);

  useEffect(() => {
    api<Config>('/api/affiliate/config')
      .then(setConfig)
      .catch((e) => setConfigError(e.message));
  }, []);

  useEffect(() => {
    if (!config?.hasAccess) return;
    api<{ store: Store | null; categories: string[] }>('/api/store')
      .then((d) => {
        setStore(d.store);
        setCategories(d.categories);
      })
      .catch(() => setStore(null));
  }, [config?.hasAccess]);

  useEffect(() => {
    if (!userId) return;
    setSelected(loadSelection(userId));
    setPack(loadPack(userId));
  }, [userId]);

  const stream = useAnalysisStream<SearchResult, Stage>('/api/affiliate/search', userId ? reportKey(userId, 'affiliate', 'search') : null, request?.body ?? {});
  const result = stream.saved?.result ?? null;
  const { run } = stream;
  // Run after the new request has rendered, so the hook sends it.
  useEffect(() => {
    if (request) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  const search = (body: SearchRequest) => setRequest({ body, nonce: Date.now() });

  const setSelection = useCallback(
    (next: RankedProduct[]) => {
      setSelected(next);
      if (userId) saveSelection(userId, next);
    },
    [userId],
  );
  const isSelected = (asin: string) => selected.some((p) => p.asin === asin);
  const toggle = (p: RankedProduct) => {
    if (isSelected(p.asin)) setSelection(selected.filter((x) => x.asin !== p.asin));
    else if (selected.length < MAX_SELECTED) setSelection([...selected, p]);
  };

  const loadedDetails = (asin: string) => {
    const d = details[asin];
    return d && d !== 'loading' && !('error' in d) ? d : null;
  };

  if (configError) return <Shell>{<div className="card text-sm text-zinc-300">{configError}</div>}</Shell>;
  if (!config) {
    return (
      <Shell>
        <div className="card flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-zinc-400" aria-label="Loading" />
        </div>
      </Shell>
    );
  }
  if (!config.hasAccess) {
    return (
      <Shell>
        <div className="card flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
          <span>{config.enabled ? 'Affiliate Intelligence is part of the paid plans.' : 'Affiliate Intelligence isn’t available yet.'}</span>
          {config.enabled && (
            <Link href="/plan" className="btn-primary btn-sm">
              See plans
            </Link>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <>
      <Shell>
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white">Search your favorite products</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Marketplace
              <select className="input w-auto py-1.5" value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    Amazon {domain}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (term.trim().length >= 2) search({ mode: 'keyword', term: term.trim(), domain });
            }}
          >
            <label className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-lg border border-bg-border bg-bg-base px-3">
              <Search size={16} className="text-zinc-500" aria-hidden="true" />
              <span className="sr-only">Or search a product</span>
              <input
                className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none"
                value={term}
                maxLength={100}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Or type a product, like “car vacuum”"
              />
            </label>
            <button type="submit" className="btn-secondary" disabled={stream.running || term.trim().length < 2}>
              Search
            </button>
          </form>
          <p className="text-xs text-zinc-500">{config.costs.search} credits per search</p>
          {stream.running && (
            <p className="flex items-center gap-2 text-sm text-zinc-300">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />{' '}
              {stream.stages.includes('rank') ? 'Picking the best 10…' : 'Reading Amazon: products, photos and features (up to a minute)…'}
            </p>
          )}
          {stream.error && (
            <p className="text-sm text-rose-300">
              {stream.error.message}
              {stream.error.refunded ? ' Your credits were returned.' : ''}
            </p>
          )}
        </section>

        {pack && (
          <Link href="/affiliate/video" className="card flex flex-wrap items-center gap-3 border-violet-500/30 hover:border-violet-400">
            <Clapperboard size={18} className="text-violet-300" aria-hidden="true" />
            <span className="flex-1 text-sm text-zinc-200">
              Your video prompts: <span className="font-semibold text-white">{pack.label}</span>, {pack.products.length} products
              {pack.seo ? ', with SEO' : ''}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-violet-200">
              Open <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        )}

        {stream.running && <ResultsSkeleton />}

        {!stream.running && result && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Top {result.products.length} in {result.label}
                </h2>
                <p className="text-xs text-zinc-500">
                  {result.mode === 'bestsellers' ? 'Ranked by best-seller rank and ratings' : 'Ranked by ratings and reviews'} · Amazon {result.domain} ·{' '}
                  {new Date(result.searchedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section className="space-y-3">

                {result.products.length === 0 ? (
                  <div className="card text-sm text-zinc-400">Nothing well rated came back. Try another niche or word.</div>
                ) : (
                  <ol className="space-y-2">
                    {result.products.map((product) => (
                      <ProductRow
                        key={product.asin}
                        product={product}
                        selected={isSelected(product.asin)}
                        canSelect={selected.length < MAX_SELECTED}
                        focused={focus?.asin === product.asin}
                        onBio={onBio.has(product.asin)}
                        onToggle={() => toggle(product)}
                        onOpen={() => setAdding(product)}
                      />
                    ))}
                  </ol>
                )}
              </section>

              <aside className="lg:sticky lg:top-4 lg:self-start">
                {/* {focus && (
              <SidePanel
                product={focus}
                details={focusDetails}
                domain={result.domain}
                selected={isSelected(focus.asin)}
                canSelect={selected.length < MAX_SELECTED}
                onToggle={() => toggle(focus)}
                onAdd={() => setAdding(focus)}
                onClose={() => setFocus(null)}
              />
            )} */}

                <SelectionBar selected={selected} onRemove={(asin) => setSelection(selected.filter((p) => p.asin !== asin))} />
                {selected.length === 0 && (
                  <div className="card space-y-2 text-sm text-zinc-400">
                    <p className="font-semibold text-zinc-200">Make a review Short</p>
                    <p>Select up to {MAX_SELECTED} products. Each gets an 8-second clip in your video prompts.</p>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}


      </Shell>
      {adding && store !== undefined && (
        <AddToBioModal
          product={adding}
          details={loadedDetails(adding.asin) ?? detailsFromList(adding)}
          store={store}
          categories={categories}
          bioBaseUrl={config.bioBaseUrl}
          defaultTags={pack ? [pack.videoTag] : []}
          onStoreCreated={(s) => setStore(s)}
          onClose={() => setAdding(null)}
          onAdded={(p: StoreProduct) => {
            setOnBio((s) => new Set(s).add(p.asin));
            if (p.category && !categories.includes(p.category)) setCategories([...categories, p.category].sort());
          }}
        />
      )}
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell pb-28">
      <div className="page-container max-w-6xl space-y-5">
        <header className="page-header flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ShoppingBag size={24} aria-hidden="true" /> Affiliate Intelligence
            </h1>
            <p className="page-subtitle">Amazon products that sell and that buyers rate well, ready for your next review Short.</p>
          </div>
          <Link href="/store" className="btn-secondary btn-sm">
            My bio page
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}

function ProductRow(props: { product: RankedProduct; selected: boolean; canSelect: boolean; focused: boolean; onBio: boolean; onToggle: () => void; onOpen: () => void }) {
  const product = props.product;
  return (
    <li className={`card flex items-center gap-3 p-3 ${props.focused ? 'ring-1 ring-violet-400' : ''}`}>
      <span className="w-7 shrink-0 text-center text-sm font-bold text-zinc-400">#{product.rank}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${product.title}`}>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.imageUrl && <img src={product.imageUrl} alt="" className="h-full w-full object-contain" referrerPolicy="no-referrer" />}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`https://amazon.com/dp/${product.asin}`} target='_blank' className="line-clamp-2 text-sm font-semibold text-white underline">{product.title}</Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
            {product.price && <p className="font-semibold text-zinc-200">{product.price.display}</p>}
            {product.rating !== null && (
              <span className="inline-flex items-center gap-0.5">
                <Star size={11} className="text-amber-300" aria-hidden="true" /> {product.rating.toFixed(1)}
              </span>
            )}
            {product.ratingsTotal !== null && <span>{product.ratingsTotal.toLocaleString()} ratings</span>}
            {product.bestSellersRank !== null && <span>#{product.bestSellersRank} best seller</span>}
            {props.onBio && <span className="text-emerald-300">On your bio</span>}
          </div>
        </div>
      </div>
      <button onClick={props.onOpen} className='flex items-center btn-secondary'>
        <Plus size={14} />
        <span className='text-xs'>Add to Bio</span>
      </button>
      <button
        type="button"
        onClick={props.onToggle}
        disabled={!props.selected && !props.canSelect}
        aria-pressed={props.selected}
        title={!props.selected && !props.canSelect ? `Up to ${MAX_SELECTED} products per video` : undefined}
        className={`btn-sm shrink-0 ${props.selected ? 'btn-primary' : 'btn-secondary'}`}
      >
        {props.selected ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
        {props.selected ? 'Selected' : 'Select'}
      </button>
    </li>
  );
}

function SelectionBar({ selected, onRemove }: { selected: RankedProduct[]; onRemove: (asin: string) => void }) {
  const label = useMemo(() => `${selected.length} of ${MAX_SELECTED} selected · ${selected.length * 8}s video`, [selected.length]);
  if (selected.length === 0) return null;
  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold text-white">{label}</p>
      <ul className="grid grid-cols-3 gap-2">
        {selected.map((p) => (
          <li key={p.asin} className="relative overflow-hidden rounded-lg border border-bg-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl ?? ''} alt="" className="aspect-square w-full object-contain p-1.5" referrerPolicy="no-referrer" />
            <button
              type="button"
              aria-label={`Remove ${p.title}`}
              title={p.title}
              onClick={() => onRemove(p.asin)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 shadow-lg"
            >
              <X size={14} aria-hidden="true" color='white' />
            </button>
          </li>
        ))}
      </ul>
      <Link href="/affiliate/video" className="btn-primary w-full justify-center">
        <Sparkles size={16} aria-hidden="true" /> Make video prompts
      </Link>
    </div>
  );
}

/** While Amazon is read: the shape of the list and the side card, so nothing jumps. */
function ResultsSkeleton() {
  return (
    <SkeletonBox label="Loading products…" className="space-y-3">
      <Skeleton width={256} height={24} />
      <Skeleton width={320} height={12} />
      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ol className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="card flex items-center gap-3 p-3">
              {/* <Skeleton width={24} height={16} /> */}
              <Skeleton width={64} height={64} containerClassName="shrink-0 leading-none" />
              <div className="min-w-0 flex-1">
                <Skeleton height={16} />
                <Skeleton height={16} width="66%" />
                <Skeleton height={12} width="50%" />
              </div>
              <Skeleton width={80} height={32} />
            </li>
          ))}
        </ol>
        <div className="card space-y-3 h-fit">
          <Skeleton height={20} width="60%" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" containerClassName="leading-none" />
            ))}
          </div>
          <Skeleton height={40} />
        </div>
      </div>
    </SkeletonBox>
  );
}
