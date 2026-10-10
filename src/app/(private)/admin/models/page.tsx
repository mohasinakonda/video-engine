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
} from 'lucide-react';
import type { AIImageModel, PlanTier } from '@/types/subscription';
import { showToast } from '@/lib/toast';

const ALL_PLAN_TIERS: { id: PlanTier; label: string; desc: string }[] = [
  { id: 'TRIAL', label: 'Trial', desc: 'Free trial users' },
  { id: 'STARTER', label: 'Starter', desc: 'Basic plan' },
  { id: 'CREATOR', label: 'Creator', desc: 'Most popular creator plan' },
  { id: 'STUDIO', label: 'Studio Pro', desc: 'Highest tier studio plan' },
];

export default function AdminModelsPage() {
  const [models, setModels] = useState<AIImageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  // Model kind tab: image models vs voice (TTS) models.
  // Voice models are ai_models rows whose id starts with "voice-"; for them,
  // creditCost means CHARACTERS PER 1 CREDIT (charge = max(1, ceil(chars / creditCost))).
  const [modelKind, setModelKind] = useState<'image' | 'voice'>('image');
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Form State
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

  useEffect(() => {
    loadModels();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setFormId('');
    setFormName('');
    setFormModelId('');
    setFormDescription('');
    // Voice tab: creditCost = characters per 1 credit (default 2000).
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
      // Voice models get a "voice-" id prefix (zero-migration kind marker).
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
        isDefault: formIsDefault,
        isActive: formIsActive,
        sortOrder: formIsDefault ? 5 : 20,
      };

      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', model: payloadModel }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Model "${payloadModel.name}" successfully saved!`);
        setIsModalOpen(false);
        loadModels();
      } else {
        showToast(data.error || 'Failed to save model.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error saving model.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleActive = async (model: AIImageModel) => {
    const newStatus = !model.isActive;
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: model.id, isActive: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setModels((prev) =>
          prev.map((m) => (m.id === model.id ? { ...m, isActive: newStatus } : m))
        );
        showToast(`Model ${newStatus ? 'enabled' : 'disabled'}.`);
      } else {
        showToast(data.error || 'Failed to toggle status.');
      }
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      showToast('Error syncing default models.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedVoiceModels = async () => {
    if (!confirm('Seed standard voice engines (Inworld Max, Inworld Mini) into Supabase?')) return;
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
    } catch (err) {
      showToast('Error syncing voice models.');
    } finally {
      setLoading(false);
    }
  };

  // Filter models
  const isVoiceModel = (m: AIImageModel) => m.id.startsWith('voice-');
  const kindModels = models.filter((m) =>
    modelKind === 'voice' ? isVoiceModel(m) : !isVoiceModel(m)
  );
  const filteredModels = kindModels.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.modelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTier =
      tierFilter === 'ALL'
        ? true
        : tierFilter === 'RESTRICTED'
        ? m.allowedPlans && !m.allowedPlans.includes('TRIAL')
        : m.allowedPlans && m.allowedPlans.includes(tierFilter as PlanTier);

    return matchesSearch && matchesTier;
  });

  const totalActive = kindModels.filter((m) => m.isActive !== false).length;
  const totalRestricted = kindModels.filter((m) => m.allowedPlans && !m.allowedPlans.includes('TRIAL')).length;
  const defaultModel = kindModels.find((m) => m.isDefault);

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Navigation Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Admin Engine Hub
              </span>
              {isLiveSupabase && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={11} /> Supabase Live DB
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="text-cyan-400" size={28} /> DeepInfra AI Models &amp; Pricing Control
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Dynamically add new inference models from DeepInfra, configure per-image credit consumption, and restrict access exclusively to Creator and Studio Pro tiers.
            </p>
          </div>

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
              onClick={loadModels}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
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
          </div>
        </div>

        {/* Analytics & Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Total Models</span>
              <Cpu size={16} className="text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">{kindModels.length}</div>
            <p className="text-[11px] text-zinc-500 mt-1">Configured in database</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Active Engines</span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{totalActive}</div>
            <p className="text-[11px] text-zinc-500 mt-1">Ready for generation</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Tier Restricted</span>
              <Lock size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{totalRestricted}</div>
            <p className="text-[11px] text-zinc-500 mt-1">Exclusive to paid plans</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Default Model</span>
              <Star size={16} className="text-yellow-400" />
            </div>
            <div className="text-sm font-bold text-white truncate mt-1">
              {defaultModel?.name || 'None Set'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {modelKind === 'voice'
                ? `${(defaultModel?.creditCost ?? 2000).toLocaleString()} chars / 1 credit`
                : `${defaultModel?.creditCost ?? 2} credits / image`}
            </p>
          </div>
        </div>

        {/* Model kind tabs: image vs voice engines */}
        <div className="flex items-center gap-2">
          {(
            [
              { id: 'image', label: 'Image Models', icon: Cpu },
              { id: 'voice', label: 'Voice Models', icon: Mic },
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
          {modelKind === 'voice' && (
            <span className="text-[11px] text-zinc-500 ml-1">
              Credit cost = characters per 1 credit · charge = max(1, ceil(chars ÷ rate))
            </span>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
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

          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search models or paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Models Grid */}
        {loading ? (
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
                ? 'Add a voice engine or click "Sync Voice Models" to seed Inworld defaults.'
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
                          <Zap size={11} /> {model.creditCost} {model.creditCost === 1 ? 'Credit' : 'Credits'} / Img
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
                          className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                          title="Edit model configuration"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model)}
                          className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
                          title="Delete model"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Model Title & Path */}
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                        {model.name}
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate" title={model.modelId}>
                        {model.modelId}
                      </p>
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
                            path: 'inworld-ai/inworld-tts-1.5-max',
                            name: 'Inworld Max',
                            charsPerCredit: 2000,
                          },
                          {
                            path: 'inworld-ai/inworld-tts-1.5-mini',
                            name: 'Inworld Mini',
                            charsPerCredit: 4000,
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

                {/* Credit Cost — voice models use characters-per-credit */}
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
      </div>
    </div>
  );
}
