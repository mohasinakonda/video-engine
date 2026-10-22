'use client';

import { useEffect, useState } from 'react';
import { Check, ClipboardCopy, Download, ExternalLink, ImageIcon, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { base64ToUint8Array, generateImage } from '@/lib/gemini';
import { deleteMediaBlob, getMediaBlob, saveMediaBlob } from '@/lib/media-storage';
import { hasEnoughCredits, holdLocalCredits, syncCreditsFromServer } from '@/lib/subscription-store';
import { thumbnailPrompt, type ThumbnailConcept } from '@/lib/youtube/create/packaging';
import type { AIImageModel } from '@/types/subscription';

/** The same look and negative prompt as the Launch Kit's Thumbnail Studio. */
const STYLE_SUFFIX = 'vibrant saturated colors, bright exposure, sharp focus, crisp detail, high contrast';
const NEGATIVE_PROMPT =
  'blurry, out of focus, low quality, noisy, jpeg artifacts, distorted face, bad anatomy, deformed hands, watermark, signature, dull muted colors, dark underexposed image';
const PREFERRED_MODEL_ID = 'black-forest-labs/FLUX-2-klein-9b';

export type ThumbnailLink = { imageId?: string | null; canvaDesignId?: string | null };

const blobKey = (projectId: string, imageId: string) => `create_thumb_${projectId}_${imageId}`;

/** The image models, loaded once per page. */
let modelsRequest: Promise<AIImageModel[]> | null = null;
function loadModels(): Promise<AIImageModel[]> {
  modelsRequest ??= fetch('/api/models')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.models) ? (d.models as AIImageModel[]).filter((m) => !m.id.startsWith('voice-') && m.isActive !== false) : []))
    .catch(() => {
      modelsRequest = null;
      return [];
    });
  return modelsRequest;
}

/** The model the Thumbnail Studio would use: its preferred one when this plan may use it. */
function useThumbnailModel(): AIImageModel | null {
  const { subscription } = useAuth();
  const [model, setModel] = useState<AIImageModel | null>(null);
  useEffect(() => {
    let live = true;
    loadModels().then((models) => {
      const preferred = models.find((m) => m.modelId === PREFERRED_MODEL_ID);
      const allowed = preferred && (!preferred.allowedPlans?.length || (subscription?.tier && preferred.allowedPlans.includes(subscription.tier)));
      if (live) setModel((allowed ? preferred : models.find((m) => m.isDefault) ?? models[0]) ?? null);
    });
    return () => {
      live = false;
    };
  }, [subscription?.tier]);
  return model;
}

/** A thumbnail idea's image from this browser's storage, as a live URL; undefined while loading. */
export function useThumbnailImage(projectId: string, imageId: string | undefined): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(imageId ? undefined : null);
  useEffect(() => {
    if (!imageId) return setUrl(null);
    setUrl(undefined);
    let live = true;
    let made: string | null = null;
    getMediaBlob(blobKey(projectId, imageId)).then((blob) => {
      if (!live) return;
      made = blob ? URL.createObjectURL(blob) : null;
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [projectId, imageId]);
  return url;
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/**
 * Make a thumbnail idea into an image, edit it in Canva and bring it back, or download it.
 * Images stay in this browser; only their id is saved with the idea.
 */
export function ThumbnailMaker({
  projectId,
  concept,
  locked,
  onLink,
}: {
  projectId: string;
  concept: ThumbnailConcept;
  /** Unsaved edits: the image must be made from the saved idea. */
  locked: boolean;
  /** Saves the link; resolves to an error message, or null. */
  onLink: (link: ThumbnailLink) => Promise<string | null>;
}) {
  const model = useThumbnailModel();
  const image = useThumbnailImage(projectId, concept.imageId);
  const { prompt: suggested, textLeftOut } = thumbnailPrompt(concept);
  const [prompt, setPrompt] = useState(suggested);
  const [busy, setBusy] = useState<'image' | 'canva' | 'sync' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  useEffect(() => setPrompt(suggested), [suggested]);

  const cost = model?.creditCost ?? 2;
  // The idea's image is gone when this browser's storage was cleared or it's another device.
  const missing = !!concept.imageId && image === null;

  const keep = async (blob: Blob, link: Omit<ThumbnailLink, 'imageId'> = {}) => {
    const imageId = crypto.randomUUID();
    await saveMediaBlob(blobKey(projectId, imageId), blob);
    const error = await onLink({ ...link, imageId });
    if (error) {
      await deleteMediaBlob(blobKey(projectId, imageId));
      throw new Error(error);
    }
    if (concept.imageId) await deleteMediaBlob(blobKey(projectId, concept.imageId));
  };

  const makeImage = async () => {
    if (!prompt.trim()) return setMessage({ text: 'Describe the image first.', tone: 'error' });
    if (!hasEnoughCredits(cost) || !holdLocalCredits(cost)) return setMessage({ text: `You need ${cost} credits to make an image.`, tone: 'error' });
    setBusy('image');
    setMessage(null);
    try {
      // /api/generate-image charges the real credits and refunds them if it fails.
      const result = await generateImage(prompt.trim(), NEGATIVE_PROMPT, { model: model?.modelId, baseStyle: STYLE_SUFFIX, aspectRatio: '16:9' });
      if (!result.base64Image) throw new Error('No image came back.');
      const bytes = base64ToUint8Array(result.base64Image.replace(/^data:[^,]+,/, ''));
      // A new image starts a new Canva design.
      await keep(new Blob([bytes.buffer as ArrayBuffer], { type: result.mimeType || 'image/jpeg' }), { canvaDesignId: null });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'The image couldn’t be made. Try again.', tone: 'error' });
    } finally {
      setBusy(null);
      syncCreditsFromServer();
    }
  };

  const editInCanva = async () => {
    if (!image) return;
    // Opened now, while the click still counts, so the browser doesn't block it.
    const tab = window.open('about:blank', '_blank');
    setBusy('canva');
    setMessage(null);
    try {
      const res = await fetch('/api/integrations/canva/create-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: await toDataUrl(await (await fetch(image)).blob()), title: concept.mainSubject.slice(0, 60), textOverlayHint: concept.text }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.isConnected === false) {
        if (data.isConfigured && tab) {
          tab.location.href = `/api/integrations/canva/auth?return_to=${encodeURIComponent(`/create/${projectId}/package`)}`;
          setMessage({ text: 'Approve Canva in the new tab, then come back and press “Edit in Canva” again.', tone: 'info' });
        } else {
          tab?.close();
          setMessage({ text: 'Canva isn’t set up for this app yet. Download the image and upload it to Canva instead.', tone: 'error' });
        }
        return;
      }
      if (!res.ok || !data.editUrl) throw new Error(data.error || 'Canva didn’t open the design.');
      if (tab) tab.location.href = data.editUrl;
      else window.open(data.editUrl, '_blank', 'noopener,noreferrer');
      const error = await onLink({ canvaDesignId: data.designId });
      setMessage({
        text: error ?? `Opened in Canva${data.method === 'flat-image' ? ' as one picture (this Canva account can’t split it into layers)' : ', with each part as its own layer'}. When you’re done, press “Bring back from Canva”.`,
        tone: error ? 'error' : 'info',
      });
    } catch (err) {
      tab?.close();
      setMessage({ text: err instanceof Error ? err.message : 'Canva didn’t open. Try again.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const syncFromCanva = async () => {
    if (!concept.canvaDesignId) return;
    setBusy('sync');
    setMessage(null);
    try {
      const res = await fetch('/api/create/canva-export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ designId: concept.canvaDesignId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.image) throw new Error(data.code === 'canva_not_connected' ? 'Connect Canva again: press “Edit in Canva”.' : data.error || 'Couldn’t bring it back.');
      await keep(await dataUrlToBlob(data.image), { canvaDesignId: concept.canvaDesignId });
      setMessage({ text: 'Your Canva version is here.', tone: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Couldn’t bring it back.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = `thumbnail-${concept.mainSubject.slice(0, 40).replace(/[^\w-]+/g, '-').toLowerCase() || 'image'}.png`;
    a.click();
  };

  const [copied, setCopied] = useState(false);
  const copyPrompt = async () => {
    try {
      // Unedited: copy the version with the thumbnail text in any language, for models that can write it.
      await navigator.clipboard.writeText(prompt === suggested ? thumbnailPrompt(concept, { anyText: true }).prompt : prompt.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ text: 'Couldn’t copy. Open “See or change what the image model is asked for” and copy it from there.', tone: 'error' });
    }
  };
  const copyButton = (
    <button type="button" className="btn-ghost btn-sm" disabled={!prompt.trim()} onClick={copyPrompt}>
      {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
      {copied ? 'Copied' : 'Copy prompt'}
    </button>
  );

  const status = message &&<p className={`text-xs ${message.tone === 'error' ? 'text-rose-300' : 'text-sky-200'}`}>{message.text}</p>;
  const lockedNote = locked && <p className="text-xs text-amber-300">Save your changes first.</p>;

  if (image === undefined) return <div className="w-full aspect-video rounded-lg bg-bg-surface animate-pulse" />;

  if (image) {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
        <img src={image} alt="" className="w-full aspect-video rounded-lg object-cover border border-bg-border" />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn-secondary btn-sm" disabled={!!busy || locked} onClick={editInCanva}>
            {busy === 'canva' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Edit in Canva
          </button>
          {concept.canvaDesignId && (
            <button type="button" className="btn-ghost btn-sm" disabled={!!busy || locked} onClick={syncFromCanva}>
              {busy === 'sync' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Bring back from Canva
            </button>
          )}
          <button type="button" className="btn-ghost btn-sm" disabled={!!busy} onClick={download}>
            <Download size={14} />
            Download
          </button>
          <button type="button" className="btn-ghost btn-sm" disabled={!!busy || locked} onClick={makeImage} title={`Uses ${cost} credits`}>
            {busy === 'image' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            New image
          </button>
          {copyButton}
        </div>
        {lockedNote}
        {status}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-bg-border p-3 space-y-2">
      <p className="text-sm text-zinc-200 inline-flex items-center gap-1.5">
        <ImageIcon size={15} className="text-zinc-400" />
        {missing ? 'Its image was made in another browser. Make it again here.' : 'Make this idea into an image'}
      </p>
      <details>
        <summary className="text-xs text-zinc-400 cursor-pointer">See or change what the image model is asked for</summary>
        <textarea className="input text-sm mt-1.5 min-h-[88px]" value={prompt} maxLength={1500} onChange={(e) => setPrompt(e.target.value)} />
      </details>
      {textLeftOut && <p className="text-xs text-zinc-400">The text “{concept.text}” isn’t drawn: the image model can’t write it well. Add it in Canva.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={!!busy || locked || !model} onClick={makeImage}>
          {busy === 'image' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy === 'image' ? 'Making the image…' : 'Make image'}
        </button>
        {copyButton}
        <span className="text-xs text-zinc-500">Uses {cost} credits · about 20 seconds</span>
      </div>
      {lockedNote}
      {status}
    </div>
  );
}
