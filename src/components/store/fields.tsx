'use client';

/**
 * Product fields shared by the Store and the Add to bio modal: tags as chips, a free-text category
 * that suggests the store's own, and an image from a link or an upload to the creator's ImageKit.
 */
import { useId, useState } from 'react';
import { ImageUp, Loader2, X } from 'lucide-react';
import { normalizeTags, slugTag } from '@/lib/store/validation';

export function TagInput({ value, onChange, id }: { value: string[]; onChange: (tags: string[]) => void; id?: string }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map(slugTag).filter(Boolean);
    if (parts.length) onChange(normalizeTags([...value, ...parts]));
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-bg-border bg-bg-base px-2 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-bg-elevated px-2 py-0.5 text-xs text-zinc-200">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} className="text-zinc-500 hover:text-white" onClick={() => onChange(value.filter((x) => x !== t))}>
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-zinc-500"
        value={draft}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length ? 'Add a tag' : 'car-gadgets, must-have…'}
      />
    </div>
  );
}

export function CategoryInput({ value, onChange, options, id }: { value: string; onChange: (v: string) => void; options: string[]; id?: string }) {
  const listId = useId();
  return (
    <>
      <input
        id={id}
        className="input w-full"
        list={listId}
        value={value}
        maxLength={40}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type one, pick one, or leave empty"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

interface UploadAuth {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
  folder: string;
}

/** An image link, or a file uploaded straight from the browser to the creator's own ImageKit. */
export function ImageField({ value, onChange, canUpload, id }: { value: string; onChange: (url: string) => void; canUpload: boolean; id?: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setError('Use an image file up to 10 MB.');
      return;
    }
    setUploading(true);
    try {
      const authRes = await fetch('/api/store/imagekit-auth', { method: 'POST' });
      const auth = (await authRes.json()) as UploadAuth & { error?: string };
      if (!authRes.ok) throw new Error(auth.error || 'Upload isn’t available.');
      const form = new FormData();
      form.append('file', file);
      form.append('fileName', file.name.replace(/[^\w.-]/g, '_').slice(0, 80) || 'product.jpg');
      form.append('publicKey', auth.publicKey);
      form.append('signature', auth.signature);
      form.append('expire', String(auth.expire));
      form.append('token', auth.token);
      form.append('folder', auth.folder);
      const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || typeof data.url !== 'string') throw new Error(data.message || 'ImageKit didn’t take the file. Check your keys in Settings.');
      onChange(data.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bg-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <span className="text-[11px] text-zinc-500">No image</span>}
        </div>
        <div className="flex-1 space-y-2">
          <input id={id} className="input w-full" type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… image link" />
          {canUpload && (
            <label className="btn-secondary btn-sm cursor-pointer">
              {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ImageUp size={14} aria-hidden="true" />}
              {uploading ? 'Uploading…' : 'Upload to ImageKit'}
              <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}

export interface ProductDraft {
  asin: string;
  name: string;
  imageUrl: string;
  category: string;
  tags: string[];
  blurb: string;
  show: boolean;
}

export const emptyDraft = (): ProductDraft => ({ asin: '', name: '', imageUrl: '', category: '', tags: [], blurb: '', show: true });

/** The editable fields of a product. `asinEditable` is off when editing an existing one. */
export function ProductFields(props: {
  draft: ProductDraft;
  onChange: (d: ProductDraft) => void;
  categories: string[];
  canUpload: boolean;
  asinEditable: boolean;
  /** Images to choose from (Add to bio), shown above the link field. */
  imageChoices?: string[];
}) {
  const { draft, onChange } = props;
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => onChange({ ...draft, [k]: v });
  const ids = { asin: useId(), name: useId(), image: useId(), category: useId(), tags: useId(), blurb: useId() };
  return (
    <div className="space-y-4">
      {props.asinEditable && (
        <div>
          <label className="label" htmlFor={ids.asin}>
            ASIN or Amazon link
          </label>
          <input
            id={ids.asin}
            className="input w-full"
            value={draft.asin}
            onChange={(e) => set('asin', e.target.value)}
            placeholder="B0ABCDEF12 or https://www.amazon.com/…/dp/B0ABCDEF12"
          />
        </div>
      )}
      {props.imageChoices && props.imageChoices.length > 0 && (
        <fieldset>
          <legend className="label">Image</legend>
          <div className="flex flex-wrap gap-2">
            {props.imageChoices.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => set('imageUrl', src)}
                aria-pressed={draft.imageUrl === src}
                className={`h-20 w-20 overflow-hidden rounded-lg border-2 bg-white ${draft.imageUrl === src ? 'border-violet-400' : 'border-transparent hover:border-bg-border'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label className="label" htmlFor={ids.name}>
          Title
        </label>
        <input id={ids.name} className="input w-full" value={draft.name} maxLength={200} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={ids.image}>
          {props.imageChoices?.length ? 'Or another image link' : 'Image'}
        </label>
        <ImageField id={ids.image} value={draft.imageUrl} onChange={(v) => set('imageUrl', v)} canUpload={props.canUpload} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={ids.category}>
            Category <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <CategoryInput id={ids.category} value={draft.category} onChange={(v) => set('category', v)} options={props.categories} />
        </div>
        <div>
          <label className="label" htmlFor={ids.tags}>
            Tags
          </label>
          <TagInput id={ids.tags} value={draft.tags} onChange={(v) => set('tags', v)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={ids.blurb}>
          Short note <span className="font-normal text-zinc-500">(optional, shown under the title)</span>
        </label>
        <input
          id={ids.blurb}
          className="input w-full"
          value={draft.blurb}
          maxLength={160}
          onChange={(e) => set('blurb', e.target.value)}
          placeholder="Why you like it, in one line"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={draft.show} onChange={(e) => set('show', e.target.checked)} />
        Show on my bio page
      </label>
    </div>
  );
}
