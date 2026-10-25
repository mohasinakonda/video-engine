'use client';

import { useEffect } from 'react';
import { X, RotateCcw, Play, Loader2, SlidersHorizontal } from 'lucide-react';
import {
  VOICE_STYLES,
  VOICE_USE_CASES,
  getVoiceStyle,
  type StyleParams,
} from '@/lib/voice-styles';

interface StyleDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedStyleId: string | null;
  onSelectStyle: (id: string | null) => void;
  selectedUseCaseId: string | null;
  onSelectUseCase: (id: string | null) => void;
  params: StyleParams;
  onParamsChange: (p: StyleParams) => void;
  /** True when the user dragged a slider away from the selected preset. */
  isCustom: boolean;
  onReset: () => void;
  onPreview: () => void;
  previewing: boolean;
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-zinc-200">{label}</span>
        <span className="text-xxs font-mono text-zinc-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400 h-1.5 cursor-pointer"
        aria-label={label}
      />
      <p className="text-xxs text-zinc-500 mt-0.5">{hint}</p>
    </div>
  );
}

export default function StyleDrawer({
  open,
  onClose,
  selectedStyleId,
  onSelectStyle,
  selectedUseCaseId,
  onSelectUseCase,
  params,
  onParamsChange,
  isCustom,
  onReset,
  onPreview,
  previewing,
}: StyleDrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const activeStyle = getVoiceStyle(selectedStyleId);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Voice style settings"
        className={`fixed top-0 right-0 z-50 h-full w-[340px] max-w-[92vw] bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-zinc-800 text-zinc-300">
              <SlidersHorizontal size={14} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white leading-tight">Delivery Style</h2>
              <p className="text-xxs text-zinc-500">Direct the performance, keep the voice</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close style settings"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Voice style */}
          <div>
            <label htmlFor="voice-style-select" className="text-xxs font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Voice Style
            </label>
            <select
              id="voice-style-select"
              value={selectedStyleId ?? ''}
              onChange={(e) => onSelectStyle(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              <option value="">Default (no style)</option>
              {VOICE_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-xxs text-zinc-500 mt-1">
              {activeStyle ? activeStyle.hint : 'Same delivery as before — nothing changes.'}
              {isCustom && activeStyle && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                  Custom
                </span>
              )}
            </p>
          </div>

          {/* Use case */}
          <div>
            <label htmlFor="use-case-select" className="text-xxs font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Use Case
            </label>
            <select
              id="use-case-select"
              value={selectedUseCaseId ?? ''}
              onChange={(e) => onSelectUseCase(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              <option value="">None</option>
              {VOICE_USE_CASES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
            <p className="text-xxs text-zinc-500 mt-1">Shortcut — auto-picks the matching style above.</p>
          </div>

          {/* Fine-tune sliders */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xxs font-semibold uppercase tracking-wider text-zinc-400">
                Fine-tune
              </span>
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1 text-xxs text-zinc-400 hover:text-white transition-colors"
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
            <Slider
              label="Expressiveness"
              hint="Emotion intensity — higher = more animated"
              value={params.expressiveness}
              min={0}
              max={100}
              step={1}
              display={`${params.expressiveness}`}
              onChange={(v) => onParamsChange({ ...params, expressiveness: v })}
            />
            <Slider
              label="Pacing"
              hint="Lower = slower, more deliberate delivery"
              value={params.cfgWeight}
              min={0.1}
              max={1}
              step={0.05}
              display={params.cfgWeight.toFixed(2)}
              onChange={(v) => onParamsChange({ ...params, cfgWeight: v })}
            />
            <Slider
              label="Variation"
              hint="Take-to-take difference in delivery"
              value={params.temperature}
              min={0}
              max={1}
              step={0.05}
              display={params.temperature.toFixed(2)}
              onChange={(v) => onParamsChange({ ...params, temperature: v })}
            />
          </div>
        </div>

        <div className="px-4 py-3.5 border-t border-zinc-800">
          <button
            type="button"
            onClick={onPreview}
            disabled={previewing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-60 transition-colors"
          >
            {previewing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {previewing ? 'Generating preview…' : 'Preview style'}
          </button>
          <p className="text-xxs text-zinc-500 text-center mt-2">Free preview · uses your active voice</p>
        </div>
      </aside>
    </>
  );
}
