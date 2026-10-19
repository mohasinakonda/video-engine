'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Plus,
  Save,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { showToast } from '@/lib/toast';

interface Settings {
  enabled: boolean;
  allowedPlans: string[];
  diagnosisCreditCost: number;
  videoAnalysisCreditCost: number;
  textModels: string[];
  visionModels: string[];
  maxVideos: number;
  maxRetentionVideos: number;
  maxThumbnails: number;
  hourlyLimitPerUser: number;
  updatedAt: string | null;
}

type ModelKind = 'text' | 'vision';

const PLANS = [
  { id: 'TRIAL', label: 'Trial' },
  { id: 'STARTER', label: 'Starter' },
  { id: 'CREATOR', label: 'Creator' },
  { id: 'STUDIO', label: 'Studio' },
];

const LIMITS: { key: keyof Settings; label: string; hint: string; min: number; max: number }[] = [
  { key: 'maxVideos', label: 'Videos per analysis', hint: 'Most recent uploads read per diagnosis', min: 10, max: 200 },
  { key: 'maxRetentionVideos', label: 'Retention videos', hint: 'Videos whose retention curve is analyzed', min: 0, max: 20 },
  { key: 'maxThumbnails', label: 'Thumbnails analyzed', hint: 'Sent to the vision model (top + weakest)', min: 0, max: 24 },
  { key: 'hourlyLimitPerUser', label: 'Runs per user per hour', hint: 'Protects the Google API quota', min: 1, max: 100 },
];

export default function AdminChannelDoctorPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/channel-doctor')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setSettings(data.settings))
      .catch(() => setError('Could not load settings.'));
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  const togglePlan = (plan: string) => {
    if (!settings) return;
    const has = settings.allowedPlans.includes(plan);
    update('allowedPlans', has ? settings.allowedPlans.filter((p) => p !== plan) : [...settings.allowedPlans, plan]);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const { updatedAt: _ignored, ...body } = settings;
      const res = await fetch('/api/admin/channel-doctor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save settings.');
      setSettings(data.settings);
      showToast('Channel Doctor settings saved', 'success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              <Stethoscope size={22} className="text-blue-400" />
              Channel Doctor Settings
            </h1>
            <p className="page-subtitle">Credits, plan access, AI models and limits. Changes apply to the next analysis.</p>
          </div>
          <button type="button" onClick={save} disabled={!settings || saving} className="btn-accent">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save
          </button>
        </header>

        {error && <p className="text-sm text-rose-400 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">{error}</p>}

        {!settings ? (
          !error && (
            <div className="card flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-400" />
            </div>
          )
        ) : (
          <>
            <section className="card space-y-4">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block text-sm font-semibold text-white">Feature enabled</span>
                  <span className="block text-xs text-zinc-400">When off, users see &quot;temporarily unavailable&quot; and no analysis runs.</span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => update('enabled', e.target.checked)}
                  className="w-5 h-5 accent-emerald-500"
                />
              </label>

              <div className="pt-4 border-t border-bg-border">
                <p className="text-sm font-semibold text-white">Plans that can run analyses</p>
                <p className="text-xs text-zinc-400 mb-3">
                  Based on the user&apos;s active plan; an expired plan counts as Trial. Anyone can still connect or disconnect.
                </p>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map((plan) => {
                    const on = settings.allowedPlans.includes(plan.id);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => togglePlan(plan.id)}
                        aria-pressed={on}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          on
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                            : 'bg-bg-elevated border-bg-border text-zinc-400 hover:text-white'
                        }`}
                      >
                        {on && <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" />}
                        {plan.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="card space-y-3">
              <p className="text-sm font-semibold text-white">Credit cost</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumberField
                  label="Channel diagnosis"
                  hint="Charged when a diagnosis starts; refunded if it fails"
                  value={settings.diagnosisCreditCost}
                  min={0}
                  max={1000}
                  onChange={(v) => update('diagnosisCreditCost', v)}
                />
                <NumberField
                  label="Single-video analysis"
                  hint="Charged per video analysis"
                  value={settings.videoAnalysisCreditCost}
                  min={0}
                  max={1000}
                  onChange={(v) => update('videoAnalysisCreditCost', v)}
                />
              </div>
            </section>

            <ModelList
              kind="text"
              title="Report models (text)"
              hint="Write the diagnosis from the measured evidence. The first model is tried first; the rest are fallbacks."
              models={settings.textModels}
              onChange={(list) => update('textModels', list)}
            />
            <ModelList
              kind="vision"
              title="Thumbnail models (vision)"
              hint="Must accept images. Models that can't see images are rejected on save."
              models={settings.visionModels}
              onChange={(list) => update('visionModels', list)}
            />

            <section className="card space-y-3">
              <p className="text-sm font-semibold text-white">Limits</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {LIMITS.map((limit) => (
                  <NumberField
                    key={limit.key}
                    label={limit.label}
                    hint={limit.hint}
                    value={settings[limit.key] as number}
                    min={limit.min}
                    max={limit.max}
                    onChange={(v) => update(limit.key, v as never)}
                  />
                ))}
              </div>
            </section>

            {settings.updatedAt && (
              <p className="text-xs text-zinc-500">Last saved {new Date(settings.updatedAt).toLocaleString()}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-zinc-300 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.floor(Number(e.target.value) || 0))))}
        className="input text-sm font-mono"
      />
      <span className="block text-[11px] text-zinc-500 mt-1">
        {hint} ({min}–{max})
      </span>
    </label>
  );
}

function ModelList({
  kind,
  title,
  hint,
  models,
  onChange,
}: {
  kind: ModelKind;
  title: string;
  hint: string;
  models: string[];
  onChange: (models: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});

  const move = (index: number, delta: number) => {
    const next = [...models];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  const add = () => {
    const id = draft.trim();
    if (!id || models.includes(id) || models.length >= 5) return;
    onChange([...models, id]);
    setDraft('');
  };

  const test = async (modelId: string) => {
    setTesting(modelId);
    try {
      const res = await fetch('/api/admin/channel-doctor/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, modelId }),
      });
      const data = await res.json();
      setResults((prev) => ({
        ...prev,
        [modelId]: data.ok
          ? { ok: true, text: `Works · ${(data.ms / 1000).toFixed(1)}s · valid JSON` }
          : { ok: false, text: data.error || 'Test failed' },
      }));
    } catch {
      setResults((prev) => ({ ...prev, [modelId]: { ok: false, text: 'Test request failed' } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <section className="card space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-zinc-400">{hint}</p>
      </div>

      <ol className="space-y-2">
        {models.map((model, index) => (
          <li key={model} className="p-2.5 rounded-lg bg-bg-elevated border border-bg-border space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-500 w-14 shrink-0">{index === 0 ? 'Primary' : `Backup ${index}`}</span>
              <span className="flex-1 min-w-0 truncate font-mono text-xs text-white">{model}</span>
              <button type="button" onClick={() => test(model)} disabled={testing !== null} className="btn-ghost btn-xs" title="Run a small real request">
                {testing === model ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                Test
              </button>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="btn-ghost btn-xs" aria-label="Move up">
                <ArrowUp size={12} />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === models.length - 1} className="btn-ghost btn-xs" aria-label="Move down">
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => onChange(models.filter((m) => m !== model))}
                disabled={models.length === 1}
                className="btn-ghost btn-xs text-rose-400"
                aria-label="Remove"
              >
                <Trash2 size={12} />
              </button>
            </div>
            {results[model] && (
              <p className={`text-[11px] pl-16 ${results[model].ok ? 'text-emerald-400' : 'text-rose-400'}`}>{results[model].text}</p>
            )}
          </li>
        ))}
      </ol>

      {models.length < 5 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            placeholder="DeepInfra model id, e.g. google/gemma-3-27b-it"
            className="input text-xs font-mono"
          />
          <button type="button" onClick={add} disabled={!draft.trim()} className="btn-secondary btn-sm shrink-0">
            <Plus size={14} />
            Add
          </button>
        </div>
      )}
    </section>
  );
}
