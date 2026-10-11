'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  Palette,
  Eye,
  EyeOff,
  Star,
  Check,
  Lock,
  Mic,
  Globe,
  Sliders,
  Volume2,
} from 'lucide-react';
import type { AIImageModel, PlanTier } from '@/types/subscription';
import type { VoicePreset } from '@/lib/voice-catalog';
import { VOICE_LANGUAGES } from '@/lib/voice-catalog';
import { showToast } from '@/lib/toast';

const ALL_PLAN_TIERS: { id: PlanTier; label: string; desc: string }[] = [
  { id: 'TRIAL', label: 'Trial', desc: 'Free trial users' },
  { id: 'STARTER', label: 'Starter', desc: 'Basic plan' },
  { id: 'CREATOR', label: 'Creator', desc: 'Most popular creator plan' },
  { id: 'STUDIO', label: 'Studio Pro', desc: 'Highest tier studio plan' },
];

const PRESET_TAG_OPTIONS = [
  'narration',
  'conversational',
  'character',
  'advertising',
];

export default function AdminModelsPage() {
  const [models, setModels] = useState<AIImageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  // Model kind tab: image models vs voice (TTS) models.
  const [modelKind, setModelKind] = useState<'image' | 'voice'>('image');
  // Voice sub-tab: engines vs presets & languages
  const [voiceSubTab, setVoiceSubTab] = useState<'engines' | 'presets'>('engines');

  // Voice Presets state
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isEditingPreset, setIsEditingPreset] = useState(false);
  const [presetModalLoading, setPresetModalLoading] = useState(false);

  // Preset Form State
  const [presetFormId, setPresetFormId] = useState('');
  const [presetFormName, setPresetFormName] = useState('');
  const [presetFormDescription, setPresetFormDescription] = useState('');
  const [presetFormLanguage, setPresetFormLanguage] = useState('English');
  const [presetFormLanguageId, setPresetFormLanguageId] = useState('en');
  const [presetFormGender, setPresetFormGender] = useState<'neutral' | 'male' | 'female'>('neutral');
  const [presetFormTags, setPresetFormTags] = useState<string[]>(['narration']);
  const [presetFormExaggeration, setPresetFormExaggeration] = useState(50);
  const [presetFormIsDefault, setPresetFormIsDefault] = useState(false);
  const [presetFormIsActive, setPresetFormIsActive] = useState(true);

  // Model Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Model Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formModelId, setFormModelId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCreditCost, setFormCreditCost] = useState(2);
  const [formAllowedPlans, setFormAllowedPlans] = useState<PlanTier[]>(['CREATOR', 'STUDIO']);
  const [formInferenceSteps, setFormInferenceSteps] = useState(4);
  const [formGuidanceScale, setFormGuidanceScale] = useState(1.0);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  const loadModels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/models');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setModels(data.models || []);
          setIsLiveSupabase(Boolean(data.isLiveSupabase));
        }
      }
    } catch (err) {
      console.error('Error fetching admin models:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    setPresetsLoading(true);
    try {
      const res = await fetch('/api/admin/voice-presets');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVoicePresets(data.presets || []);
        }
      }
    } catch (err) {
      console.error('Error fetching admin voice presets:', err);
    } finally {
      setPresetsLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
    loadPresets();
  }, []);

  // ─── AI Model Modal Handlers ───────────────────────────────────────────────

  const openCreateModal = () => {
    setIsEditing(false);
    setFormId('');
    setFormName('');
    setFormModelId('');
    setFormDescription('');
    setFormCreditCost(modelKind === 'voice' ? 2000 : 2);
    setFormAllowedPlans(['CREATOR', 'STUDIO']);
    setFormInferenceSteps(4);
    setFormGuidanceScale(1.0);
    setFormIsDefault(false);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (model: AIImageModel) => {
    setIsEditing(true);
    setFormId(model.id);
    setFormName(model.name);
    setFormModelId(model.modelId);
    setFormDescription(model.description || '');
    setFormCreditCost(model.creditCost);
    setFormAllowedPlans(model.allowedPlans || ['CREATOR', 'STUDIO']);
    setFormInferenceSteps(model.inferenceSteps ?? 4);
    setFormGuidanceScale(model.guidanceScale ?? 1.0);
    setFormIsDefault(Boolean(model.isDefault));
    setFormIsActive(model.isActive !== false);
    setIsModalOpen(true);
  };

  const handleTogglePlan = (plan: PlanTier) => {
    if (formAllowedPlans.includes(plan)) {
      if (formAllowedPlans.length === 1) {
        showToast('At least one plan must be allowed.');
        return;
      }
      setFormAllowedPlans(formAllowedPlans.filter((p) => p !== plan));
    } else {
      setFormAllowedPlans([...formAllowedPlans, plan]);
    }
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formModelId.trim()) {
      showToast('Name and DeepInfra model ID are required.');
      return;
    }

    setModalLoading(true);
    try {
      const rawId = formId || formModelId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const isVoice = modelKind === 'voice' || rawId.startsWith('voice-');
      const finalId = isVoice && !rawId.startsWith('voice-') ? `voice-${rawId}` : rawId;
      const payloadModel: AIImageModel = {
        id: finalId,
        name: formName.trim(),
        modelId: formModelId.trim(),
        provider: 'deepinfra',
        description: formDescription.trim(),
        creditCost: Math.max(isVoice ? 1 : 0, formCreditCost),
        allowedPlans: formAllowedPlans,
        inferenceSteps: formInferenceSteps,
        guidanceScale: formGuidanceScale,
        sortOrder: 10,
        isDefault: formIsDefault,
        isActive: formIsActive,
      };

      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', model: payloadModel }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEditing ? 'Model updated successfully!' : 'Model created successfully!');
        setIsModalOpen(false);
        loadModels();
      } else {
        showToast(data.error || 'Failed to save model.');
      }
    } catch {
      showToast('Network error saving model.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleActive = async (model: AIImageModel) => {
    const nextState = !model.isActive;
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: model.id, isActive: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setModels((prev) =>
          prev.map((m) => (m.id === model.id ? { ...m, isActive: nextState } : m))
        );
        showToast(`Model ${nextState ? 'activated' : 'deactivated'}.`);
      } else {
        showToast(data.error || 'Failed to update model status.');
      }
    } catch {
      showToast('Network error toggling status.');
    }
  };

  const handleDeleteModel = async (model: AIImageModel) => {
    if (!confirm(`Are you sure you want to delete model "${model.name}"?`)) return;

    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: model.id }),
      });
      const data = await res.json();
      if (data.success) {
        setModels((prev) => prev.filter((m) => m.id !== model.id));
        showToast(`Model "${model.name}" deleted.`);
      } else {
        showToast(data.error || 'Failed to delete model.');
      }
    } catch {
      showToast('Network error deleting model.');
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm('Seed standard DeepInfra models (FLUX.1 Schnell, FLUX.1 Dev, SDXL Turbo) into Supabase?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Standard models seeded successfully!');
        loadModels();
      } else {
        showToast(data.error || 'Failed to seed models.');
      }
    } catch {
      showToast('Error syncing default models.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedVoiceModels = async () => {
    if (!confirm('Seed standard voice engines (Chatterbox Multilingual, Chatterbox Turbo, MiMo V2.5) into Supabase?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed-voice' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Voice models seeded successfully!');
        loadModels();
      } else {
        showToast(data.error || 'Failed to seed voice models.');
      }
    } catch {
      showToast('Error syncing voice models.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Voice Preset Handlers ─────────────────────────────────────────────────

  const openCreatePresetModal = () => {
    setIsEditingPreset(false);
    setPresetFormId('');
    setPresetFormName('');
    setPresetFormDescription('');
    setPresetFormLanguage('English');
    setPresetFormLanguageId('en');
    setPresetFormGender('neutral');
    setPresetFormTags(['narration']);
    setPresetFormExaggeration(50);
    setPresetFormIsDefault(false);
    setPresetFormIsActive(true);
    setIsPresetModalOpen(true);
  };

  const openEditPresetModal = (preset: VoicePreset) => {
    setIsEditingPreset(true);
    setPresetFormId(preset.id);
    setPresetFormName(preset.name);
    setPresetFormDescription(preset.description || '');
    setPresetFormLanguage(preset.language || 'English');
    setPresetFormLanguageId(preset.languageId || 'en');
    setPresetFormGender(preset.gender || 'neutral');
    setPresetFormTags(preset.tags || ['narration']);
    setPresetFormExaggeration(Math.round((preset.exaggeration ?? 0.5) * 100));
    setPresetFormIsDefault(Boolean(preset.isDefault));
    setPresetFormIsActive(preset.isActive !== false);
    setIsPresetModalOpen(true);
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetFormName.trim() || !presetFormLanguageId.trim()) {
      showToast('Name and language are required.');
      return;
    }

    setPresetModalLoading(true);
    try {
      const payload: VoicePreset = {
        id: presetFormId || `preset-${presetFormName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
        name: presetFormName.trim(),
        description: presetFormDescription.trim(),
        language: presetFormLanguage,
        languageId: presetFormLanguageId,
        gender: presetFormGender,
        tags: presetFormTags,
        exaggeration: Math.round(presetFormExaggeration) / 100,
        isDefault: presetFormIsDefault,
        isActive: presetFormIsActive,
      };

      const res = await fetch('/api/admin/voice-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', preset: payload }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEditingPreset ? 'Preset updated successfully!' : 'Preset created successfully!');
        setIsPresetModalOpen(false);
        loadPresets();
      } else {
        showToast(data.error || 'Failed to save preset.');
      }
    } catch {
      showToast('Network error saving preset.');
    } finally {
      setPresetModalLoading(false);
    }
  };

  const handleTogglePresetActive = async (preset: VoicePreset) => {
    const nextState = !preset.isActive;
    try {
      const res = await fetch('/api/admin/voice-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: preset.id, isActive: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setVoicePresets((prev) =>
          prev.map((p) => (p.id === preset.id ? { ...p, isActive: nextState } : p))
        );
        showToast(`Preset ${nextState ? 'activated' : 'deactivated'}.`);
      } else {
        showToast(data.error || 'Failed to toggle preset.');
      }
    } catch {
      showToast('Network error toggling preset.');
    }
  };

  const handleDeletePreset = async (preset: VoicePreset) => {
    if (!confirm(`Are you sure you want to delete preset "${preset.name}"?`)) return;
    try {
      const res = await fetch('/api/admin/voice-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: preset.id }),
      });
      const data = await res.json();
      if (data.success) {
        setVoicePresets((prev) => prev.filter((p) => p.id !== preset.id));
        showToast(`Preset "${preset.name}" deleted.`);
      } else {
        showToast(data.error || 'Failed to delete preset.');
      }
    } catch {
      showToast('Network error deleting preset.');
    }
  };

  const handleSeedVoicePresets = async () => {
    if (!confirm('Seed standard voice presets into Supabase database?')) return;
    setPresetsLoading(true);
    try {
      const res = await fetch('/api/admin/voice-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Default voice presets seeded successfully!');
        loadPresets();
      } else {
        showToast(data.error || 'Failed to seed presets.');
      }
    } catch {
      showToast('Error syncing default presets.');
    } finally {
      setPresetsLoading(false);
    }
  };

  // ─── Filtering & View Calculation ──────────────────────────────────────────

  const isPresetView = modelKind === 'voice' && voiceSubTab === 'presets';

  // Filter models for Image or Voice Engines
  const kindModels = models.filter((m) =>
    modelKind === 'voice' ? m.id.startsWith('voice-') : !m.id.startsWith('voice-')
  );

  const filteredModels = kindModels.filter((model) => {
    const matchesSearch =
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.modelId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (tierFilter === 'ALL') return true;
    if (tierFilter === 'RESTRICTED') return !model.allowedPlans?.includes('TRIAL');
    return model.allowedPlans?.includes(tierFilter as PlanTier);
  });

  // Filter Presets
  const filteredPresets = voicePresets.filter((preset) => {
    const q = searchQuery.toLowerCase();
    return (
      preset.name.toLowerCase().includes(q) ||
      preset.language.toLowerCase().includes(q) ||
      preset.languageId.toLowerCase().includes(q) ||
      (preset.description || '').toLowerCase().includes(q) ||
      preset.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const totalActive = isPresetView
    ? voicePresets.filter((p) => p.isActive !== false).length
    : kindModels.filter((m) => m.isActive).length;

  const totalRestricted = isPresetView
    ? new Set(voicePresets.map((p) => p.languageId)).size
    : kindModels.filter((m) => m.allowedPlans && !m.allowedPlans.includes('TRIAL')).length;

  const defaultModel = isPresetView ? null : kindModels.find((m) => m.isDefault);
  const defaultPreset = isPresetView ? voicePresets.find((p) => p.isDefault) : null;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-950 text-white min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Cpu size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  AI Model Hub
                  {isLiveSupabase ? (
                    <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Live Database
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Local Config
                    </span>
                  )}
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Manage DeepInfra models, voice engines, credit consumption, and voice presets
                </p>
              </div>
            </div>
          </div>

          {/* Action Navigation */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/admin/styles"
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Palette size={14} /> Art Styles
            </Link>
            <Link
              href="/admin/plan"
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Layers size={14} /> Plans &amp; Pricing
            </Link>
            <Link
              href="/admin/users"
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              Users
            </Link>

            <button
              onClick={() => {
                loadModels();
                loadPresets();
              }}
              disabled={loading || presetsLoading}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={loading || presetsLoading ? 'animate-spin' : ''} /> Refresh
            </button>

            {isPresetView ? (
              <>
                <button
                  onClick={handleSeedVoicePresets}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-cyan-500/20"
                >
                  <Zap size={14} /> Seed Default Presets
                </button>
                <button
                  onClick={openCreatePresetModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white shadow-lg transition-all"
                >
                  <Plus size={15} /> Add Voice Preset
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={modelKind === 'voice' ? handleSeedVoiceModels : handleSeedDefaults}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-cyan-500/20"
                >
                  <Zap size={14} />
                  {modelKind === 'voice' ? 'Sync Voice Models' : 'Sync Standard Models'}
                </button>
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-xs font-semibold text-white shadow-lg shadow-cyan-950/40 transition-all"
                >
                  <Plus size={15} /> {modelKind === 'voice' ? 'Add Voice Engine' : 'Add DeepInfra Model'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Analytics & Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">
                {isPresetView ? 'Total Presets' : 'Total Models'}
              </span>
              <Cpu size={16} className="text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {isPresetView ? voicePresets.length : kindModels.length}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Configured in database</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">
                {isPresetView ? 'Active Presets' : 'Active Engines'}
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{totalActive}</div>
            <p className="text-[11px] text-zinc-500 mt-1">Ready for generation</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">
                {isPresetView ? 'Languages' : 'Tier Restricted'}
              </span>
              {isPresetView ? <Globe size={16} className="text-indigo-400" /> : <Lock size={16} className="text-amber-400" />}
            </div>
            <div className="text-2xl font-bold text-amber-400">{totalRestricted}</div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {isPresetView ? 'Supported language codes' : 'Exclusive to paid plans'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Default Selection</span>
              <Star size={16} className="text-yellow-400" />
            </div>
            <div className="text-sm font-bold text-white truncate mt-1">
              {isPresetView
                ? defaultPreset?.name || 'None Set'
                : defaultModel?.name || 'None Set'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isPresetView
                ? `${defaultPreset?.language || 'English'} (${defaultPreset?.languageId || 'en'})`
                : modelKind === 'voice'
                ? `${(defaultModel?.creditCost ?? 2000).toLocaleString()} chars / 1 credit`
                : `${defaultModel?.creditCost ?? 2} credits / image`}
            </p>
          </div>
        </div>

        {/* Primary Tabs: Image Models vs Voice Studio */}
        <div className="flex items-center gap-2">
          {(
            [
              { id: 'image', label: 'Image Models', icon: Cpu },
              { id: 'voice', label: 'Voice Models & Presets', icon: Mic },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setModelKind(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                modelKind === t.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Voice Sub-Tabs: Voice Engines vs Voice Presets & Languages */}
        {modelKind === 'voice' && (
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVoiceSubTab('engines')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  voiceSubTab === 'engines'
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Cpu size={13} /> Voice Engines (TTS Models)
              </button>
              <button
                onClick={() => {
                  setVoiceSubTab('presets');
                  if (voicePresets.length === 0) loadPresets();
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  voiceSubTab === 'presets'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Volume2 size={13} /> Voice Presets &amp; Languages
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  {voicePresets.length}
                </span>
              </button>
            </div>
            <span className="text-[11px] text-zinc-500">
              {voiceSubTab === 'engines'
                ? 'Credit rate = characters per 1 credit (e.g. 2,000 chars = 1 credit)'
                : 'Manage voice personas, delivery exaggeration & supported languages in Supabase'}
            </span>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
          {!isPresetView ? (
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
              {[
                { id: 'ALL', label: 'All Models' },
                { id: 'RESTRICTED', label: 'Exclusive (Creator / Studio)' },
                { id: 'CREATOR', label: 'Creator Tier' },
                { id: 'STARTER', label: 'Starter Tier' },
                { id: 'TRIAL', label: 'Open to Trial' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTierFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    tierFilter === f.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-400 flex items-center gap-2">
              <Globe size={14} className="text-indigo-400" />
              <span>Showing {filteredPresets.length} voice personas saved in Supabase database</span>
            </div>
          )}

          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder={isPresetView ? "Search voice presets, languages, tags..." : "Search models or paths..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* CONTENT VIEW: VOICE PRESETS VS MODELS */}
        {isPresetView ? (
          /* Voice Presets Grid */
          presetsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <Loader2 size={30} className="animate-spin text-indigo-400" />
              <p className="text-xs">Loading voice presets from Supabase...</p>
            </div>
          ) : filteredPresets.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800">
              <Volume2 size={36} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-semibold text-zinc-300">No Voice Presets Found</p>
              <p className="text-xs text-zinc-500 mt-1">
                Add a new voice preset or click &quot;Seed Default Presets&quot; to initialize standard personas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all ${
                    preset.isActive !== false
                      ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 shadow-lg'
                      : 'bg-zinc-950/40 border-zinc-900 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {preset.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                            <Star size={10} /> Default
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                          <Globe size={11} /> {preset.language} ({preset.languageId})
                        </span>
                        {preset.gender && (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">
                            {preset.gender}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePresetActive(preset)}
                          className={`p-1.5 rounded-lg border text-xs transition-colors ${
                            preset.isActive !== false
                              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                          }`}
                          title={preset.isActive !== false ? 'Active (Click to disable)' : 'Disabled (Click to enable)'}
                        >
                          {preset.isActive !== false ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          onClick={() => openEditPresetModal(preset)}
                          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                          title="Edit Preset"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset)}
                          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete Preset"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Preset Name */}
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">{preset.name}</h3>
                      <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">ID: {preset.id}</p>
                    </div>

                    {/* Description */}
                    {preset.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    )}

                    {/* Delivery & Exaggeration */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                      <span className="flex items-center gap-1 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                        <Sliders size={11} className="text-indigo-400" />
                        {Math.round((preset.exaggeration ?? 0.5) * 100)}% Expression
                      </span>
                    </div>

                    {/* Category Tags */}
                    {preset.tags && preset.tags.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-1.5 flex-wrap">
                        {preset.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800/70 text-zinc-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* AI Models / Engines Grid */
          loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <Loader2 size={30} className="animate-spin text-cyan-400" />
              <p className="text-xs">Loading DeepInfra AI models from Supabase...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800">
              <Cpu size={36} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-semibold text-zinc-300">
                {modelKind === 'voice' ? 'No Voice Engines Found' : 'No AI Models Found'}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {modelKind === 'voice'
                  ? 'Add a voice engine or click "Sync Voice Models" to seed Chatterbox defaults.'
                  : 'Add a new DeepInfra model or click "Sync Standard Models" to seed defaults.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredModels.map((model) => {
                const isExclusive = model.allowedPlans && !model.allowedPlans.includes('TRIAL');
                return (
                  <div
                    key={model.id}
                    className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all ${
                      model.isActive
                        ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 shadow-lg'
                        : 'bg-zinc-950/40 border-zinc-900 opacity-60'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Row Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {model.isDefault && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                              <Star size={10} /> Default
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                            <Zap size={11} /> {modelKind === 'voice' ? `${model.creditCost.toLocaleString()} Chars / Credit` : `${model.creditCost} Credits / Img`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(model)}
                            className={`p-1.5 rounded-lg border text-xs transition-colors ${
                              model.isActive
                                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                            }`}
                            title={model.isActive ? 'Active (Click to disable)' : 'Disabled (Click to enable)'}
                          >
                            {model.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            onClick={() => openEditModal(model)}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Edit Model"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model)}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Model"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Model Name & Path */}
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">{model.name}</h3>
                        <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">{model.modelId}</p>
                      </div>

                      {/* Description */}
                      {model.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {model.description}
                        </p>
                      )}

                      {/* Hyperparameters */}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                        {modelKind === 'voice' ? (
                          <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                            {model.creditCost.toLocaleString()} chars / 1 credit
                          </span>
                        ) : (
                          <>
                            <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              {model.inferenceSteps ?? 4} Steps
                            </span>
                            <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              Guidance: {model.guidanceScale ?? 1.0}x
                            </span>
                          </>
                        )}
                      </div>

                      {/* Allowed Plans Badges */}
                      <div className="pt-2 border-t border-zinc-800/80">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1">
                          {isExclusive ? <Lock size={10} className="text-amber-400" /> : <ShieldCheck size={10} />}
                          Access Authorization:
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {model.allowedPlans?.map((plan) => (
                            <span
                              key={plan}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                plan === 'STUDIO'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : plan === 'CREATOR'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : plan === 'STARTER'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {plan}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Modal for Creating / Editing AI Model */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 shadow-2xl text-left space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {isEditing ? 'Edit DeepInfra AI Model' : 'Add New DeepInfra Model'}
                    </h2>
                    <p className="text-xs text-zinc-400">Configure engine endpoint, credits, and plan permissions</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveModel} className="space-y-4">
                {/* Model Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FLUX.1 Dev (Ultra Pro)"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Model Identifier / Endpoint */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">DeepInfra Model Path / ID</label>
                    <span className="text-[10px] text-zinc-500 font-mono">api.deepinfra.com/v1/inference/...</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. black-forest-labs/FLUX-1-dev"
                    value={formModelId}
                    onChange={(e) => setFormModelId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {modelKind === 'voice'
                      ? [
                          {
                            path: 'ResembleAI/chatterbox-multilingual',
                            name: 'Chatterbox Multilingual',
                            charsPerCredit: 2000,
                          },
                          {
                            path: 'ResembleAI/chatterbox-turbo',
                            name: 'Chatterbox Turbo',
                            charsPerCredit: 4000,
                          },
                          {
                            path: 'XiaomiMiMo/MiMo-V2.5-tts',
                            name: 'MiMo V2.5 (Free)',
                            charsPerCredit: 10000,
                          },
                        ].map((preset) => (
                          <button
                            type="button"
                            key={preset.path}
                            onClick={() => {
                              setFormModelId(preset.path);
                              if (!formName) setFormName(preset.name);
                              setFormCreditCost(preset.charsPerCredit);
                              setFormAllowedPlans(['CREATOR', 'STUDIO']);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono"
                          >
                            {preset.path.split('/')[1] || preset.path}
                          </button>
                        ))
                      : [
                      'black-forest-labs/FLUX-1-schnell',
                      'black-forest-labs/FLUX-1-dev',
                      'stabilityai/sdxl-turbo',
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => {
                          setFormModelId(preset);
                          if (!formName) {
                            if (preset.includes('dev')) setFormName('FLUX.1 Dev');
                            else if (preset.includes('schnell')) setFormName('FLUX.1 Schnell');
                            else setFormName('SDXL Turbo');
                          }
                          if (preset.includes('dev')) {
                            setFormCreditCost(4);
                            setFormInferenceSteps(28);
                            setFormGuidanceScale(3.5);
                            setFormAllowedPlans(['CREATOR', 'STUDIO']);
                          } else if (preset.includes('schnell')) {
                            setFormCreditCost(2);
                            setFormInferenceSteps(4);
                            setFormGuidanceScale(1.0);
                          } else if (preset.includes('turbo')) {
                            setFormCreditCost(1);
                            setFormInferenceSteps(1);
                            setFormGuidanceScale(1.0);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono"
                      >
                        {preset.split('/')[1] || preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Credit Cost */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      {modelKind === 'voice' ? 'Characters per 1 Credit' : 'Credit Cost / Image'}
                    </label>
                    <input
                      type="number"
                      min={modelKind === 'voice' ? 1 : 0}
                      max={modelKind === 'voice' ? 1000000 : 100}
                      required
                      value={formCreditCost}
                      onChange={(e) => setFormCreditCost(parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                    {modelKind === 'voice' && (
                      <p className="text-[10px] text-zinc-500">
                        Charge = max(1, ceil(characters ÷ this rate))
                      </p>
                    )}
                  </div>

                  {modelKind === 'image' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Inference Steps</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={formInferenceSteps}
                          onChange={(e) => setFormInferenceSteps(parseInt(e.target.value) || 4)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Guidance Scale</label>
                        <input
                          type="number"
                          step={0.1}
                          min={0.5}
                          max={20}
                          value={formGuidanceScale}
                          onChange={(e) => setFormGuidanceScale(parseFloat(e.target.value) || 1.0)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Plan Access Control */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Lock size={13} className="text-amber-400" /> Authorized Plans
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormAllowedPlans(['CREATOR', 'STUDIO'])}
                        className="text-[10px] text-cyan-400 hover:underline"
                      >
                        Creator &amp; Studio Pro Only
                      </button>
                      <span className="text-zinc-600">|</span>
                      <button
                        type="button"
                        onClick={() => setFormAllowedPlans(['TRIAL', 'STARTER', 'CREATOR', 'STUDIO'])}
                        className="text-[10px] text-zinc-400 hover:underline"
                      >
                        All Plans
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {ALL_PLAN_TIERS.map((tier) => {
                      const isSelected = formAllowedPlans.includes(tier.id);
                      return (
                        <div
                          key={tier.id}
                          onClick={() => handleTogglePlan(tier.id)}
                          className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-cyan-950/20 border-cyan-500/50 text-white'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{tier.label}</div>
                            <div className="text-[10px] text-zinc-500">{tier.desc}</div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                              isSelected ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-zinc-700'
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Short summary highlighting quality, latency, or best use cases..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Checkboxes for Default and Active */}
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
                    <input
                      type="checkbox"
                      checked={formIsDefault}
                      onChange={(e) => setFormIsDefault(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-cyan-500 focus:ring-0"
                    />
                    Set as Default Model
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-cyan-500 focus:ring-0"
                    />
                    Active / Enabled
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-xs font-semibold text-white shadow-lg transition-all flex items-center gap-2"
                  >
                    {modalLoading && <Loader2 size={13} className="animate-spin" />}
                    {isEditing ? 'Update Model' : 'Create Model'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Creating / Editing Voice Preset */}
        {isPresetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 shadow-2xl text-left space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400">
                    <Volume2 size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {isEditingPreset ? 'Edit Voice Preset' : 'Add New Voice Preset'}
                    </h2>
                    <p className="text-xs text-zinc-400">Configure persona name, language, delivery, and style</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPresetModalOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSavePreset} className="space-y-4">
                {/* Preset Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Preset Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Storyteller (UK), Documentary Host"
                    value={presetFormName}
                    onChange={(e) => setPresetFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Language Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Language (DeepInfra)</label>
                    <select
                      value={presetFormLanguageId}
                      onChange={(e) => {
                        const code = e.target.value;
                        const found = VOICE_LANGUAGES.find((l) => l.code === code);
                        setPresetFormLanguageId(code);
                        if (found) setPresetFormLanguage(found.name);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {VOICE_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Gender Persona</label>
                    <select
                      value={presetFormGender}
                      onChange={(e) => setPresetFormGender(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="neutral">Neutral</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                {/* Delivery Exaggeration Slider */}
                <div className="space-y-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Sliders size={13} className="text-indigo-400" /> Expressiveness &amp; Emotion: {presetFormExaggeration}%
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">Chatterbox Exaggeration</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={presetFormExaggeration}
                    onChange={(e) => setPresetFormExaggeration(parseInt(e.target.value) || 50)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>30% Calm/Documentary</span>
                    <span>50% Balanced</span>
                    <span>75% Storyteller</span>
                    <span>85% Dramatic</span>
                  </div>
                </div>

                {/* Category Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Categories / Roles</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_TAG_OPTIONS.map((tag) => {
                      const isChecked = presetFormTags.includes(tag);
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => {
                            if (isChecked) {
                              setPresetFormTags(presetFormTags.filter((t) => t !== tag));
                            } else {
                              setPresetFormTags([...presetFormTags, tag]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isChecked
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                              : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Short description of delivery style, intended tone, or ideal use cases..."
                    value={presetFormDescription}
                    onChange={(e) => setPresetFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Checkboxes for Default and Active */}
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
                    <input
                      type="checkbox"
                      checked={presetFormIsDefault}
                      onChange={(e) => setPresetFormIsDefault(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0"
                    />
                    Set as Default Preset
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
                    <input
                      type="checkbox"
                      checked={presetFormIsActive}
                      onChange={(e) => setPresetFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0"
                    />
                    Active / Enabled
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsPresetModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={presetModalLoading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white shadow-lg transition-all flex items-center gap-2"
                  >
                    {presetModalLoading && <Loader2 size={13} className="animate-spin" />}
                    {isEditingPreset ? 'Update Preset' : 'Create Preset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
