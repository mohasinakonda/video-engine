'use client';

/**
 * The Flow prompts for the selected products, in two steps (Agent Instructions, then images and
 * clips, one copy button each), the editing steps, "add all to my bio" with the video's tag, and
 * the SEO pack. Everything shown here is saved in this browser with the pack.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardCopy, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useAnalysisStream } from '@/components/youtube-doctor/use-diagnosis';
import { MODELS } from '@/lib/youtube/next-shorts/models';
import { agentInstructions, clipsBlock, editingSteps, imagesBlock } from '@/lib/affiliate/video/flow';
import type { SeoPack, VideoPack } from '@/lib/affiliate/video/types';

export type SavedPack = VideoPack & { seo?: SeoPack };

export function VideoPackView(props: {
  pack: SavedPack;
  seoKey: string;
  seoCost: number;
  onSeo: (seo: SeoPack) => void;
  onClear: () => void;
  /** Add every product to the bio page with the video's tag. */
  onAddAll: () => Promise<string>;
}) {
  const { pack } = props;
  const [addState, setAddState] = useState<{ running: boolean; message: string | null }>({ running: false, message: null });
  const seconds = pack.script.clips.length * 8;

  const addAll = async () => {
    setAddState({ running: true, message: null });
    const message = await props.onAddAll();
    setAddState({ running: false, message });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-violet-500/30 bg-bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Video prompts</p>
          <h2 className="text-lg font-bold text-white">
            {pack.label}: {pack.script.clips.length} products, {seconds} seconds
          </h2>
          <p className="text-xs text-zinc-500">
            {MODELS[pack.model].label} · 8s per clip · made {new Date(pack.createdAt).toLocaleString()} · video tag <span className="text-zinc-300">{pack.videoTag}</span>
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={props.onClear}>
          <Trash2 size={14} aria-hidden="true" /> Clear
        </button>
      </div>

      {pack.issues.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Check before you generate:</p>
            <ul>
              {pack.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Block
        step="Step 1"
        title="Agent Instructions"
        hint="Paste once into the Flow project’s Agent Instructions (the button under the prompt box)."
        text={agentInstructions(pack)}
      />
      <Block step="Step 2" title="Images" hint="Upload your photo of each product, then send this. Each clip’s start image is an edit of its photo." text={imagesBlock(pack)} />
      <Block step="Step 2" title="Clips" hint="Send after the images. One 8-second video per product, in order." text={clipsBlock(pack)} />

      <div>
        <p className="text-sm font-semibold text-zinc-200">Editing</p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-400">
          {editingSteps(pack).map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bg-border p-3">
        <p className="flex-1 text-sm text-zinc-300">
          Put these products on your bio page with the tag <span className="font-semibold text-white">{pack.videoTag}</span>, so the video’s link shows just them.
        </p>
        <button type="button" className="btn-secondary btn-sm" onClick={addAll} disabled={addState.running}>
          {addState.running ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Add all to my bio
        </button>
        {addState.message && <p className="w-full text-xs text-zinc-400">{addState.message}</p>}
      </div>

      <Seo pack={pack} seoKey={props.seoKey} cost={props.seoCost} onSeo={props.onSeo} />
    </section>
  );
}

function Seo({ pack, seoKey, cost, onSeo }: { pack: SavedPack; seoKey: string; cost: number; onSeo: (s: SeoPack) => void }) {
  const body = {
    label: pack.label,
    videoTag: pack.videoTag,
    hook: pack.script.hook,
    productNames: pack.script.clips.map((c) => c.productName),
    productTitles: pack.products.map((p) => p.title.slice(0, 300)),
  };
  const stream = useAnalysisStream<SeoPack, 'connect' | 'seo' | 'done'>('/api/affiliate/seo', seoKey, body);
  const applied = useRef(pack.seo?.createdAt ?? null);
  useEffect(() => {
    const s = stream.saved?.result;
    if (s && s.createdAt !== applied.current && (!pack.seo || s.createdAt > pack.seo.createdAt)) {
      applied.current = s.createdAt;
      onSeo(s);
    }
  }, [stream.saved, pack.seo, onSeo]);
  const seo = pack.seo;

  return (
    <div className="space-y-3 rounded-lg border border-bg-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">SEO: title, thumbnail, description, keywords</p>
          <p className="text-xs text-zinc-500">
            {seo ? 'Pick a title; the description already has your bio link.' : 'Written for this video, with your bio link and the Amazon disclosure.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{cost} credits</span>
          <button type="button" className="btn-primary btn-sm" onClick={stream.run} disabled={stream.running}>
            {stream.running ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
            {seo ? 'Write again' : 'Write SEO'}
          </button>
        </div>
      </div>
      {stream.error && (
        <p className="text-xs text-rose-300">
          {stream.error.message}
          {stream.error.refunded ? ' Your credits were returned.' : ''}
        </p>
      )}
      {seo && (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Titles</p>
            {seo.titles.map((t) => (
              <Line key={t.title} text={t.title} note={t.angle} />
            ))}
          </div>
          <Field label="Description" text={seo.description} />
          <Field label="Keywords (YouTube tags)" text={seo.keywords.join(', ')} />
          <Line text={seo.hashtags.join(' ')} note="Hashtags" />
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Thumbnail</p>
            <p className="text-sm text-zinc-300">
              {seo.thumbnail.concept}
              {seo.thumbnail.text ? ` · text: “${seo.thumbnail.text}”` : ''}
            </p>
            <Field label="Thumbnail image prompt" text={seo.thumbnail.imagePrompt} />
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ step, title, hint, text }: { step: string; title: string; hint: string; text: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">
            <span className="mr-2 rounded bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-200">{step}</span>
            {title}
          </p>
          <p className="text-xs text-zinc-500">{hint}</p>
        </div>
        <Copy text={text} />
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-base p-3 text-xs leading-relaxed text-zinc-300">{text}</pre>
    </div>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">{label}</p>
        <Copy text={text} />
      </div>
      <pre className="whitespace-pre-wrap rounded-lg bg-bg-base p-3 text-xs leading-relaxed text-zinc-300">{text}</pre>
    </div>
  );
}

function Line({ text, note }: { text: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-bg-base px-3 py-2">
      <p className="text-sm text-white">
        {text}
        {note && <span className="ml-2 text-xs text-zinc-500">{note}</span>}
      </p>
      <Copy text={text} />
    </div>
  );
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary btn-sm shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <ClipboardCopy size={14} aria-hidden="true" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}
