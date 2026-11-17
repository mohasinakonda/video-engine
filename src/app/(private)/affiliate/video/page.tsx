'use client';

/**
 * Video prompts, on their own page: the products selected on Affiliate Intelligence (up to 5, 8
 * seconds each), the Flow model, and the pack: Agent Instructions, images, clips, editing, add all
 * to the bio page, and SEO. The selection and the last pack stay in this browser.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clapperboard, Loader2, Sparkles, X } from 'lucide-react';
import { MAX_SELECTED, api, loadPack, loadSelection, savePack, saveSelection } from '@/components/affiliate/storage';
import { VideoPackView, type SavedPack } from '@/components/affiliate/video-pack';
import { useAnalysisStream } from '@/components/youtube-doctor/use-diagnosis';
import { Skeleton, SkeletonBox } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { loadReport, reportKey } from '@/lib/channel-doctor-storage';
import type { RankedProduct, SearchResult } from '@/lib/affiliate/types';
import type { SeoPack, VideoPack } from '@/lib/affiliate/video/types';
import type { Store } from '@/lib/store/repo';
import { FLOW_MODES, MODELS, type FlowMode } from '@/lib/youtube/next-shorts/models';

interface Config {
  enabled: boolean;
  hasAccess: boolean;
  costs: { search: number; video: number; seo: number };
  bioBaseUrl: string;
}

export default function AffiliateVideoPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [selected, setSelected] = useState<RankedProduct[]>([]);
  const [pack, setPack] = useState<SavedPack | null>(null);
  const [lastSearch, setLastSearch] = useState<SearchResult | null>(null);
  const [model, setModel] = useState<FlowMode>('omni');
  const [request, setRequest] = useState<{ body: object; nonce: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<Config>('/api/affiliate/config')
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!config?.hasAccess) return;
    api<{ store: Store | null }>('/api/store')
      .then((d) => setStore(d.store))
      .catch(() => setStore(null));
  }, [config?.hasAccess]);
  useEffect(() => {
    if (!userId) return;
    setSelected(loadSelection(userId));
    setPack(loadPack(userId));
    setLastSearch(loadReport<SearchResult>(reportKey(userId, 'affiliate', 'search'))?.result ?? null);
    setLoaded(true);
  }, [userId]);

  const keepPack = useCallback(
    (next: SavedPack | null) => {
      setPack(next);
      if (userId) savePack(userId, next);
    },
    [userId],
  );

  const video = useAnalysisStream<VideoPack, 'connect' | 'script' | 'done'>('/api/affiliate/video', userId ? reportKey(userId, 'affiliate', 'video') : null, request?.body ?? {});
  const { run } = video;
  useEffect(() => {
    if (request) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);
  // A newer pack replaces the saved one.
  useEffect(() => {
    const made = video.saved?.result;
    if (made?.version === 1 && (!pack || made.createdAt > pack.createdAt)) keepPack(made);
  }, [video.saved, pack, keepPack]);

  const make = () =>
    setRequest({
      body: {
        domain: lastSearch?.domain ?? 'US',
        model,
        label: lastSearch?.label ?? 'My picks',
        products: selected.map((p) => ({
          asin: p.asin,
          title: p.title.slice(0, 300),
          brand: p.brand?.slice(0, 120) ?? null,
          featureBullets: (p.featureBullets ?? []).slice(0, 8).map((b) => b.slice(0, 1000)),
          imageUrl: p.images?.[0] ?? p.imageUrl ?? null,
        })),
      },
      nonce: Date.now(),
    });

  const remove = (asin: string) => {
    const next = selected.filter((p) => p.asin !== asin);
    setSelected(next);
    if (userId) saveSelection(userId, next);
  };

  const addAll = async (p: SavedPack) => {
    if (!store || !config) return 'Create your bio page first in Store, then try again.';
    let added = 0;
    let tagged = 0;
    for (const product of p.products) {
      try {
        const body = { asin: product.asin, name: product.title.slice(0, 200), imageUrl: product.imageUrl, source: 'canopy', tags: [p.videoTag] };
        const { existed } = await api<{ existed: boolean }>('/api/store/products', { method: 'POST', body: JSON.stringify(body) });
        if (existed) tagged++;
        else added++;
      } catch {
        // keep going: the message counts what worked
      }
    }
    return `${added} added, ${tagged} already there (tag added). Link: ${config.bioBaseUrl.replace(/\/$/, '')}/@${store.handle}?q=${p.videoTag}`;
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-5">
        <Link href="/affiliate" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden="true" /> Back to products
        </Link>
        <header className="page-header">
          <h1 className="page-title flex items-center gap-2">
            <Clapperboard size={24} aria-hidden="true" /> Video prompts
          </h1>
          <p className="page-subtitle">A fast product-review Short for Google Flow: 8 seconds per product, on your own product photos.</p>
        </header>

        {error ? (
          <div className="card text-sm text-zinc-300">{error}</div>
        ) : !config || !loaded ? (
          <PageSkeleton />
        ) : !config.hasAccess ? (
          <div className="card text-sm text-zinc-300">Affiliate Intelligence isn’t on your plan.</div>
        ) : (
          <>
            <section className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white">
                  {selected.length} of {MAX_SELECTED} products · {selected.length * 8}s video
                </h2>
                <Link href="/affiliate" className="btn-ghost btn-sm">
                  Change products
                </Link>
              </div>
              {selected.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No products selected.{' '}
                  <Link href="/affiliate" className="underline hover:text-white">
                    Pick up to {MAX_SELECTED}
                  </Link>{' '}
                  first.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {selected.map((p, i) => (
                    <li key={p.asin} className="relative rounded-xl border border-bg-border bg-bg-base">
                      <div className="flex aspect-square items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-2" referrerPolicy="no-referrer" />}
                      </div>
                      <div className='p-2'>
                        <p className="line-clamp-2  text-xs text-zinc-200">
                          {/* <span className="font-semibold text-violet-300">clip-{i + 1}</span>  */}
                          {p.title}
                        </p>
                      </div>

                      <button
                        type="button"
                        aria-label={`Remove ${p.title}`}
                        onClick={() => remove(p.asin)}
                        disabled={video.running}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 shadow-lg"
                      >
                        <X size={14} aria-hidden="true" color='white' />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-bg-border pt-4">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  Flow model
                  <select className="input w-auto py-1.5 text-sm" value={model} onChange={(e) => setModel(e.target.value as FlowMode)}>
                    {FLOW_MODES.map((m) => (
                      <option key={m} value={m}>
                        {MODELS[m].label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn-primary" onClick={make} disabled={video.running || selected.length === 0}>
                  {video.running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                  {video.running ? 'Writing the prompts…' : pack ? 'Make new prompts' : 'Make video prompts'}
                </button>
                <span className="text-xs text-zinc-500">
                  {config.costs.video} credits{pack ? ' · replaces the prompts below' : ''}
                </span>
              </div>
              {video.error && (
                <p className="text-sm text-rose-300">
                  {video.error.message}
                  {video.error.refunded ? ' Your credits were returned.' : ''}
                </p>
              )}
            </section>

            {video.running ? (
              <PackSkeleton />
            ) : (
              pack && (
                <VideoPackView
                  pack={pack}
                  seoKey={userId ? reportKey(userId, 'affiliate', `seo:${pack.createdAt}`) : ''}
                  seoCost={config.costs.seo}
                  onSeo={(seo: SeoPack) => keepPack({ ...pack, seo })}
                  onClear={() => {
                    if (window.confirm('Delete these video prompts?')) keepPack(null);
                  }}
                  onAddAll={() => addAll(pack)}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <SkeletonBox label="Loading…" className="card space-y-4">
      <Skeleton width={224} height={20} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" containerClassName="leading-none" />
        ))}
      </div>
      <Skeleton width={256} height={36} />
    </SkeletonBox>
  );
}

/** While the prompts are written: the shape of the pack, so nothing jumps when it arrives. */
function PackSkeleton() {
  return (
    <section className="space-y-4 rounded-2xl border border-violet-500/30 bg-bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm text-zinc-300">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Writing a clip for each product, then checking it (about 20–40 seconds)…
      </p>
      <SkeletonBox label="Writing the video prompts…" className="space-y-4">
        <Skeleton width={288} height={24} />
        {['Agent Instructions', 'Images', 'Clips'].map((t) => (
          <div key={t} className="space-y-2">
            <Skeleton width={160} height={16} />
            <Skeleton height={112} />
          </div>
        ))}
      </SkeletonBox>
    </section>
  );
}
