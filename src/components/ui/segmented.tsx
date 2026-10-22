'use client';

/**
 * Choosing one of a few options (tabs, sort, checkpoints): the options sit together inside one
 * grey track, and the chosen one is white. Reads as a control, unlike a badge or a lone button.
 */
export interface SegmentedOption<T extends string> {
  id: T;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** For screen readers: what is being chosen. */
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto gap-0.5 p-1 rounded-xl bg-bg-elevated border border-bg-border">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              active ? 'bg-white text-zinc-950 font-medium shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
