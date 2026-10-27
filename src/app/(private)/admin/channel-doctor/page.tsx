'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Plus,
  Compass,
  PenLine,
  ScanSearch,
  Save,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { YouTubeUsageCard } from '@/components/admin/youtube-usage-card';

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
  trialFreeDiagnoses: number;
  discover: DiscoverSettings;
  create: CreateSettings;
  audit: AuditSettings;
  updatedAt: string | null;
}

interface AuditSettings {
  enabled: boolean;
  videoAuditCreditCost: number;
  channelAuditCreditCost: number;
  runsPerUserDay: number;
  maxComments: number;
  maxThumbnails: number;
}

const AUDIT_FIELDS: { key: Exclude<keyof AuditSettings, 'enabled'>; label: string; hint: string; min: number; max: number }[] = [
  { key: 'videoAuditCreditCost', label: 'Video analysis (credits)', hint: 'Any public video', min: 0, max: 1000 },
  { key: 'channelAuditCreditCost', label: 'Channel analysis (credits)', hint: 'Any public channel', min: 0, max: 1000 },
  { key: 'runsPerUserDay', label: 'Analyses per user per day', hint: 'Protects the shared YouTube quota', min: 1, max: 500 },
  { key: 'maxComments', label: 'Comments read per video', hint: '0 turns viewer themes off', min: 0, max: 100 },
  { key: 'maxThumbnails', label: 'Thumbnails per channel analysis', hint: 'Vision calls', min: 0, max: 20 },
];

interface CreateSettings {
  enabled: boolean;
  allowedPlans: string[];
  briefCreditCost: number;
  scriptCreditCost: number;
  packagingCreditCost: number;
  maxProjectsPerUser: number;
  topicSearchCreditCost: number;
  topicSearchesPerUserDay: number;
  topicSearchBaselineChannels: number;
  bundleCreditCost: number;
  bundleBriefDrafts: number;
  bundleScriptWrites: number;
  bundleSectionRewrites: number;
  bundlePackagingRuns: number;
  bundleTopicSearches: number;
}

interface Weights {
  channelFit: number;
  competitorPerformance: number;
  momentum: number;
  contentGap: number;
  competition: number;
  productionFit: number;
  phase1: number;
}

interface DiscoverSettings {
  enabled: boolean;
  allowedPlans: string[];
  discoveryCreditCost: number;
  researchCreditCost: number;
  opportunityCreditCost: number;
  maxCompetitors: number;
  videosPerCompetitor: number;
  searchCallsPerDiscovery: number;
  searchDailyGlobalLimit: number;
  discoveryRunsPerUserDay: number;
  dailyQuotaUnits: number;
  embeddingModels: string[];
  maxCompetitorThumbnails: number;
  weights: Weights;
}

type ModelKind = 'text' | 'vision' | 'embedding';

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
  { key: 'trialFreeDiagnoses', label: 'Free diagnoses on Trial', hint: 'Per user and per channel; 0 turns it off', min: 0, max: 10 },
];

type NumberKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

const DISCOVER_COSTS: { key: NumberKey<DiscoverSettings>; label: string; hint: string }[] = [
  { key: 'discoveryCreditCost', label: 'Find competitors', hint: 'Uses YouTube search; charged per run' },
  { key: 'researchCreditCost', label: 'Market research', hint: 'Full research and next-video opportunities' },
  { key: 'opportunityCreditCost', label: 'Opportunity deep-dive', hint: 'One opportunity with thumbnails' },
];

const DISCOVER_LIMITS: { key: NumberKey<DiscoverSettings>; label: string; hint: string; min: number; max: number }[] = [
  { key: 'maxCompetitors', label: 'Competitors per user', hint: 'Active channels on the watchlist', min: 1, max: 25 },
  { key: 'videosPerCompetitor', label: 'Videos per competitor', hint: 'Recent uploads read for the baseline', min: 15, max: 100 },
  { key: 'searchCallsPerDiscovery', label: 'Searches per discovery', hint: 'search.list calls in one run', min: 1, max: 5 },
  { key: 'searchDailyGlobalLimit', label: 'Search calls per day (all users)', hint: 'YouTube allows 100/day for the whole app', min: 0, max: 100000 },
  { key: 'discoveryRunsPerUserDay', label: 'Discovery runs per user per day', hint: 'Keeps the shared search budget fair', min: 0, max: 50 },
  { key: 'dailyQuotaUnits', label: 'YouTube units per day (Google limit)', hint: 'From Cloud console → Quotas (searches have their own limit); used by the usage dashboard', min: 1, max: 100000000 },
  { key: 'maxCompetitorThumbnails', label: 'Competitor thumbnails analyzed', hint: 'Sent to the vision model per run', min: 0, max: 30 },
];

const CREATE_COSTS: { key: NumberKey<CreateSettings>; label: string; hint: string }[] = [
  { key: 'briefCreditCost', label: 'Video brief', hint: 'AI fills the brief from an idea' },
  { key: 'scriptCreditCost', label: 'Script', hint: 'Full script; one section costs half' },
  { key: 'packagingCreditCost', label: 'Packaging', hint: 'Title and thumbnail concepts' },
];

const WEIGHTS: { key: keyof Weights; label: string }[] = [
  { key: 'channelFit', label: 'Channel fit' },
  { key: 'competitorPerformance', label: 'Competitor performance' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'contentGap', label: 'Content gap' },
  { key: 'competition', label: 'Competition (lower is better)' },
  { key: 'productionFit', label: 'Production fit' },
  { key: 'phase1', label: 'Channel Doctor diagnosis' },
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

  const updateDiscover = <K extends keyof DiscoverSettings>(key: K, value: DiscoverSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, discover: { ...prev.discover, [key]: value } } : prev));

  const toggle = (plans: string[], plan: string) => (plans.includes(plan) ? plans.filter((p) => p !== plan) : [...plans, plan]);
  const togglePlan = (plan: string) => settings && update('allowedPlans', toggle(settings.allowedPlans, plan));
  const toggleDiscoverPlan = (plan: string) => settings && updateDiscover('allowedPlans', toggle(settings.discover.allowedPlans, plan));
  const updateCreate = <K extends keyof CreateSettings>(key: K, value: CreateSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, create: { ...prev.create, [key]: value } } : prev));
  const toggleCreatePlan = (plan: string) => settings && updateCreate('allowedPlans', toggle(settings.create.allowedPlans, plan));
  const updateAudit = <K extends keyof AuditSettings>(key: K, value: AuditSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, audit: { ...prev.audit, [key]: value } } : prev));

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

        <YouTubeUsageCard />

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
                <PlanPicker selected={settings.allowedPlans} onToggle={togglePlan} />
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

            <DiscoverSection
              discover={settings.discover}
              update={updateDiscover}
              togglePlan={toggleDiscoverPlan}
            />

            <CreateSection create={settings.create} update={updateCreate} togglePlan={toggleCreatePlan} />

            <AuditSection audit={settings.audit} update={updateAudit} />

            {settings.updatedAt && (
              <p className="text-xs text-zinc-500">Last saved {new Date(settings.updatedAt).toLocaleString()}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlanPicker({ selected, onToggle }: { selected: string[]; onToggle: (plan: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLANS.map((plan) => {
        const on = selected.includes(plan.id);
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onToggle(plan.id)}
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
  );
}

/** Discover (Phase 2): switch, plans, prices, limits, embedding models and score weights. */
function DiscoverSection({
  discover,
  update,
  togglePlan,
}: {
  discover: DiscoverSettings;
  update: <K extends keyof DiscoverSettings>(key: K, value: DiscoverSettings[K]) => void;
  togglePlan: (plan: string) => void;
}) {
  const weightTotal = WEIGHTS.reduce((sum, w) => sum + discover.weights[w.key], 0);

  return (
    <div className="space-y-6 pt-6 border-t border-bg-border">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Compass size={18} className="text-emerald-400" />
          Discover
        </h2>
        <p className="text-xs text-zinc-400">Competitor research and next-video opportunities. Uses the report models above.</p>
      </div>

      <section className="card space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span>
            <span className="block text-sm font-semibold text-white">Discover enabled</span>
            <span className="block text-xs text-zinc-400">
              Keep off for users until YouTube approves the derived-metrics use case (API audit).
            </span>
          </span>
          <input
            type="checkbox"
            checked={discover.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
            className="w-5 h-5 accent-emerald-500"
          />
        </label>
        <div className="pt-4 border-t border-bg-border">
          <p className="text-sm font-semibold text-white mb-3">Plans that can use Discover</p>
          <PlanPicker selected={discover.allowedPlans} onToggle={togglePlan} />
        </div>
      </section>

      <section className="card space-y-3">
        <p className="text-sm font-semibold text-white">Credit cost</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DISCOVER_COSTS.map((cost) => (
            <NumberField
              key={cost.key}
              label={cost.label}
              hint={cost.hint}
              value={discover[cost.key]}
              min={0}
              max={1000}
              onChange={(v) => update(cost.key, v)}
            />
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <p className="text-sm font-semibold text-white">Limits and YouTube quota</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DISCOVER_LIMITS.map((limit) => (
            <NumberField
              key={limit.key}
              label={limit.label}
              hint={limit.hint}
              value={discover[limit.key]}
              min={limit.min}
              max={limit.max}
              onChange={(v) => update(limit.key, v)}
            />
          ))}
        </div>
      </section>

      <ModelList
        kind="embedding"
        title="Topic models (embeddings)"
        hint="Group similar video titles into topics. Use a multilingual model so Bangla and English titles match."
        models={discover.embeddingModels}
        onChange={(list) => update('embeddingModels', list)}
      />

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Opportunity score weights</p>
            <p className="text-xs text-zinc-400">How much each signal counts in the 0–100 opportunity score. Must add up to 100.</p>
          </div>
          <span className={`text-sm font-mono font-semibold ${weightTotal === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {weightTotal}/100
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WEIGHTS.map((w) => (
            <NumberField
              key={w.key}
              label={w.label}
              hint="Weight"
              value={discover.weights[w.key]}
              min={0}
              max={100}
              onChange={(v) => update('weights', { ...discover.weights, [w.key]: v })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Create (Phase 3): switch, plans, prices and limits. */
function CreateSection({
  create,
  update,
  togglePlan,
}: {
  create: CreateSettings;
  update: <K extends keyof CreateSettings>(key: K, value: CreateSettings[K]) => void;
  togglePlan: (plan: string) => void;
}) {
  return (
    <div className="space-y-6 pt-6 border-t border-bg-border">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <PenLine size={18} className="text-sky-400" />
          Create
        </h2>
        <p className="text-xs text-zinc-400">Brief, script and packaging. Uses the report models above.</p>
      </div>

      <section className="card space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span>
            <span className="block text-sm font-semibold text-white">Create enabled</span>
            <span className="block text-xs text-zinc-400">Admins can use it while it is off for users.</span>
          </span>
          <input type="checkbox" checked={create.enabled} onChange={(e) => update('enabled', e.target.checked)} className="w-5 h-5 accent-emerald-500" />
        </label>
        <div className="pt-4 border-t border-bg-border">
          <p className="text-sm font-semibold text-white mb-3">Plans that can use Create</p>
          <PlanPicker selected={create.allowedPlans} onToggle={togglePlan} />
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Price per video</p>
          <p className="text-xs text-zinc-400">Charged once, when a video is started. It includes these AI runs. Past an allowance, the per-step prices below apply.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Credits per video" hint="Refunded if the project can’t be created" value={create.bundleCreditCost} min={0} max={1000} onChange={(v) => update('bundleCreditCost', v)} />
          <NumberField label="AI briefs included" hint="Draft or fill empty parts" value={create.bundleBriefDrafts} min={0} max={50} onChange={(v) => update('bundleBriefDrafts', v)} />
          <NumberField label="Full scripts included" hint="Write or write again" value={create.bundleScriptWrites} min={0} max={50} onChange={(v) => update('bundleScriptWrites', v)} />
          <NumberField label="Part rewrites included" hint="Across the whole script" value={create.bundleSectionRewrites} min={0} max={200} onChange={(v) => update('bundleSectionRewrites', v)} />
          <NumberField label="Packaging runs included" hint="Title and thumbnail ideas" value={create.bundlePackagingRuns} min={0} max={50} onChange={(v) => update('bundlePackagingRuns', v)} />
          <NumberField label="Topic searches included" hint="Also limited per day" value={create.bundleTopicSearches} min={0} max={20} onChange={(v) => update('bundleTopicSearches', v)} />
        </div>
      </section>

      <section className="card space-y-3">
        <p className="text-sm font-semibold text-white">Per-step prices (past the allowance, or older videos)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CREATE_COSTS.map((cost) => (
            <NumberField key={cost.key} label={cost.label} hint={cost.hint} value={create[cost.key]} min={0} max={1000} onChange={(v) => update(cost.key, v)} />
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <p className="text-sm font-semibold text-white">Limits</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="Projects per user"
            hint="Active (not archived) projects"
            value={create.maxProjectsPerUser}
            min={1}
            max={10000}
            onChange={(v) => update('maxProjectsPerUser', v)}
          />
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Topic search in the brief</p>
          <p className="text-xs text-zinc-400">“Who made videos on this”: one YouTube search call per run, from the shared daily search budget unless the user brings their own API key.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Credits per search" hint="Charged up front, refunded on failure" value={create.topicSearchCreditCost} min={0} max={1000} onChange={(v) => update('topicSearchCreditCost', v)} />
          <NumberField label="Searches per user per day" hint="0 turns it off" value={create.topicSearchesPerUserDay} min={0} max={100} onChange={(v) => update('topicSearchesPerUserDay', v)} />
          <NumberField label="Channels compared with their usual" hint="About 2 quota units each" value={create.topicSearchBaselineChannels} min={0} max={20} onChange={(v) => update('topicSearchBaselineChannels', v)} />
        </div>
      </section>
    </div>
  );
}

function AuditSection({ audit, update }: { audit: AuditSettings; update: <K extends keyof AuditSettings>(key: K, value: AuditSettings[K]) => void }) {
  return (
    <div className="space-y-6 pt-6 border-t border-bg-border">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ScanSearch size={18} className="text-amber-300" />
          Channel and video analysis
        </h2>
        <p className="text-xs text-zinc-400">Analyze any public channel or video from Discover. Follows Discover’s plans; needs Discover switched on too.</p>
      </div>
      <section className="card space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span>
            <span className="block text-sm font-semibold text-white">Analysis enabled</span>
            <span className="block text-xs text-zinc-400">Admins can use it while it is off for users.</span>
          </span>
          <input type="checkbox" checked={audit.enabled} onChange={(e) => update('enabled', e.target.checked)} className="w-5 h-5 accent-emerald-500" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-bg-border">
          {AUDIT_FIELDS.map((f) => (
            <NumberField key={f.key} label={f.label} hint={f.hint} value={audit[f.key]} min={f.min} max={f.max} onChange={(v) => update(f.key, v)} />
          ))}
        </div>
      </section>
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
        [modelId]: !data.ok
          ? { ok: false, text: data.error || 'Test failed' }
          : kind === 'embedding'
            ? { ok: true, text: `Works · ${(data.ms / 1000).toFixed(1)}s · ${data.dimensions} dimensions · similar titles scored ${data.similarity}` }
            : { ok: true, text: `Works · ${(data.ms / 1000).toFixed(1)}s · valid JSON` },
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
            placeholder={kind === 'embedding' ? 'DeepInfra model id, e.g. BAAI/bge-m3' : 'DeepInfra model id, e.g. google/gemma-3-27b-it'}
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
