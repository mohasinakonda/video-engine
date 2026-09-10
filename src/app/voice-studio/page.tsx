'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusCircle } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import VoicePresetForm from '@/components/voice-preset-form';
import VoicePresetList from '@/components/voice-preset-list';
import { getPresets, savePreset, deletePreset, setDefaultPreset } from '@/lib/store';
import type { VoicePreset } from '@/types';

function generateId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_PRESET: Partial<VoicePreset> = {
  name: '',
  voiceCharacter: 'Aoede',
  scene: '',
  sampleContext: '',
  pace: 1.0,
  accent: 'American English',
  isDefault: false,
};

export default function VoiceStudioPage() {
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<VoicePreset>>(DEFAULT_PRESET);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(true);

  const loadPresets = useCallback(async () => {
    const all = await getPresets();
    setPresets(all);
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  function handleSelect(preset: VoicePreset) {
    setSelectedId(preset.id);
    setForm({ ...preset });
    setIsNew(false);
  }

  function handleNew() {
    setSelectedId(null);
    setForm({ ...DEFAULT_PRESET });
    setIsNew(true);
  }

  function handleChange(field: keyof VoicePreset, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name?.trim()) return;
    setSaving(true);

    const preset: VoicePreset = {
      id: isNew ? generateId() : (selectedId ?? generateId()),
      name: form.name!,
      voiceCharacter: form.voiceCharacter ?? 'Aoede',
      scene: form.scene ?? '',
      sampleContext: form.sampleContext ?? '',
      pace: form.pace ?? 1.0,
      accent: form.accent ?? 'American English',
      isDefault: form.isDefault ?? false,
      createdAt: isNew ? Date.now() : (form.createdAt ?? Date.now()),
    };

    // If this is the first preset, make it default
    if (isNew && presets.length === 0) preset.isDefault = true;

    await savePreset(preset);
    await loadPresets();

    setSelectedId(preset.id);
    setForm({ ...preset });
    setIsNew(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await deletePreset(id);
    await loadPresets();
    if (selectedId === id) {
      handleNew();
    }
  }

  async function handleSetDefault(id: string) {
    await setDefaultPreset(id);
    await loadPresets();
    if (form.id === id) {
      setForm((prev) => ({ ...prev, isDefault: true }));
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Voice Studio</h1>
              <p className="text-sm text-slate-500 mt-0.5">Create and manage voice presets for your projects</p>
            </div>
            <button onClick={handleNew} className="btn-secondary">
              <PlusCircle size={14} />
              New Preset
            </button>
          </div>
        </header>

        {/* Two-panel layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Preset List */}
          <div className="w-64 flex-shrink-0 border-r border-bg-border bg-bg-surface/30 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Saved Presets ({presets.length})
              </h2>
            </div>
            <VoicePresetList
              presets={presets}
              selectedId={selectedId}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          </div>

          {/* Right: Configuration Form */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-xl">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-white">
                  {isNew ? 'New Voice Preset' : `Edit: ${form.name}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isNew
                    ? 'Configure voice character, scene, and delivery parameters.'
                    : 'Modify preset settings. Click "Save Changes" when done.'}
                </p>
              </div>

              <div className="card">
                <VoicePresetForm
                  preset={form}
                  onChange={handleChange}
                  onSave={handleSave}
                  saving={saving}
                  isNew={isNew}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
