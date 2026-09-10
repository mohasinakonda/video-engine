'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Plus,
  Trash2,
  Check,
  Star,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { BaseStylePreset } from '@/types';
import {
  getStylePresets,
  saveStylePreset,
  deleteStylePreset,
  setDefaultStylePreset,
  BUILT_IN_STYLE_PRESETS,
} from '@/lib/store';
import { generateImage, base64ToBlobUrl } from '@/lib/gemini';
import { getApiKey } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StylePresetModalProps {
  onClose: () => void;
  onSelect: (preset: BaseStylePreset) => void;
  selectedId?: string;
}

// ─── Empty preset template ────────────────────────────────────────────────────

function newPreset(): BaseStylePreset {
  return {
    id: `style_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    stylePrompt: '',
    negativePrompt: '',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: false,
    createdAt: Date.now(),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StylePresetModal({
  onClose,
  onSelect,
  selectedId,
}: StylePresetModalProps) {
  const [presets, setPresets] = useState<BaseStylePreset[]>([]);
  const [editing, setEditing] = useState<BaseStylePreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load presets
  useEffect(() => {
    getStylePresets().then(setPresets);
  }, []);

  async function handleSave() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.stylePrompt.trim()) return;

    setSaving(true);
    await saveStylePreset({ ...editing, createdAt: editing.createdAt || Date.now() });
    const updated = await getStylePresets();
    setPresets(updated);
    setEditing(null);
    setIsCreating(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await deleteStylePreset(id);
    const updated = await getStylePresets();
    setPresets(updated);
  }

  async function handleSetDefault(id: string) {
    await setDefaultStylePreset(id);
    const updated = await getStylePresets();
    setPresets(updated);
  }

  async function handleTestStyle() {
    if (!editing) return;
    setTesting(true);
    setTestError('');
    setTestImageUrl(null);

    try {
      const apiKey = await getApiKey();
      if (!apiKey) {
        setTestError('No API key configured. Set your Gemini API key in Settings.');
        return;
      }
      const testPrompt = `A scenic landscape. ${editing.stylePrompt}`;
      const result = await generateImage(apiKey, testPrompt, editing.negativePrompt);
      setTestImageUrl(base64ToBlobUrl(result.base64Image, result.mimeType));
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  function handleSelect(preset: BaseStylePreset) {
    onSelect(preset);
    onClose();
  }

  const builtIns = presets.filter((p) => p.isBuiltIn);
  const customs = presets.filter((p) => !p.isBuiltIn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-bg-surface border border-bg-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple/30 to-accent-cyan/20 border border-accent-purple/30 flex items-center justify-center">
              <Palette size={15} className="text-accent-purple-light" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Base Style Presets</h2>
              <p className="text-xs text-slate-500">Select or create an art style for your video</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Preset List */}
          <div className="w-72 flex-shrink-0 border-r border-bg-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {/* Built-in presets */}
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 py-1">
                Built-in Styles
              </p>
              {builtIns.map((preset) => (
                <PresetListItem
                  key={preset.id}
                  preset={preset}
                  isSelected={selectedId === preset.id}
                  isEditing={editing?.id === preset.id}
                  onEdit={() => { setEditing(preset); setIsCreating(false); setTestImageUrl(null); setTestError(''); }}
                  onSelect={() => handleSelect(preset)}
                  onSetDefault={() => handleSetDefault(preset.id)}
                  onDelete={null}
                />
              ))}

              {/* Custom presets */}
              {customs.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 py-1 pt-3">
                    Custom Styles
                  </p>
                  {customs.map((preset) => (
                    <PresetListItem
                      key={preset.id}
                      preset={preset}
                      isSelected={selectedId === preset.id}
                      isEditing={editing?.id === preset.id}
                      onEdit={() => { setEditing(preset); setIsCreating(false); setTestImageUrl(null); setTestError(''); }}
                      onSelect={() => handleSelect(preset)}
                      onSetDefault={() => handleSetDefault(preset.id)}
                      onDelete={() => handleDelete(preset.id)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Add Custom */}
            <div className="p-3 border-t border-bg-border flex-shrink-0">
              <button
                onClick={() => {
                  const p = newPreset();
                  setEditing(p);
                  setIsCreating(true);
                  setTestImageUrl(null);
                  setTestError('');
                }}
                className="btn-secondary w-full justify-center text-xs"
              >
                <Plus size={13} />
                New Custom Style
              </button>
            </div>
          </div>

          {/* Right: Editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {!editing ? (
              <div className="flex flex-col items-center justify-center h-full text-center min-h-[300px]">
                <Palette size={32} className="text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">Select a style to preview or edit</p>
                <p className="text-xs text-slate-600 mt-1">or create a new custom style</p>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {isCreating ? 'New Custom Style' : editing.name}
                    {editing.isBuiltIn && (
                      <span className="ml-2 text-xs text-slate-500 font-normal">(built-in — read-only)</span>
                    )}
                  </h3>
                </div>

                {/* Name */}
                {!editing.isBuiltIn && (
                  <div>
                    <label className="label">Style Name</label>
                    <input
                      className="input"
                      placeholder="e.g. Dark Cinematic Documentary"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>
                )}

                {/* Style Prompt */}
                <div>
                  <label className="label">Style Prompt</label>
                  <textarea
                    className="textarea h-24"
                    placeholder="e.g. Photorealistic, cinematic lighting, 8k resolution, muted colors…"
                    value={editing.stylePrompt}
                    onChange={(e) => setEditing({ ...editing, stylePrompt: e.target.value })}
                    readOnly={editing.isBuiltIn}
                  />
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="label">Negative Prompt <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
                  <textarea
                    className="textarea h-16"
                    placeholder="e.g. cartoon, blurry, distorted faces, low resolution"
                    value={editing.negativePrompt ?? ''}
                    onChange={(e) => setEditing({ ...editing, negativePrompt: e.target.value })}
                    readOnly={editing.isBuiltIn}
                  />
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="label">Aspect Ratio</label>
                  <div className="flex gap-2">
                    {(['16:9', '9:16'] as const).map((ar) => (
                      <button
                        key={ar}
                        onClick={() => !editing.isBuiltIn && setEditing({ ...editing, aspectRatio: ar })}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all duration-150 ${
                          editing.aspectRatio === ar
                            ? 'bg-accent-purple/20 border-accent-purple/50 text-accent-purple-light'
                            : 'bg-bg-elevated border-bg-border text-slate-400 hover:text-white'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Test Style */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={handleTestStyle}
                      disabled={testing || !editing.stylePrompt.trim()}
                      className="btn-secondary text-xs"
                    >
                      {testing
                        ? <Loader2 size={13} className="animate-spin" />
                        : <ImageIcon size={13} />}
                      {testing ? 'Generating…' : 'Test Style (1 image)'}
                    </button>
                    {testError && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle size={11} />
                        {testError}
                      </span>
                    )}
                  </div>

                  {testImageUrl && (
                    <div className="rounded-xl overflow-hidden border border-bg-border animate-fade-in">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={testImageUrl}
                        alt="Style test result"
                        className="w-full object-cover max-h-64"
                      />
                      <p className="text-xs text-slate-500 px-3 py-2 bg-bg-elevated">
                        Style test — &ldquo;A scenic landscape&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  {!editing.isBuiltIn && (
                    <button
                      onClick={handleSave}
                      disabled={saving || !editing.name.trim() || !editing.stylePrompt.trim()}
                      className="btn-primary text-xs"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      {isCreating ? 'Create Style' : 'Save Changes'}
                    </button>
                  )}
                  <button
                    onClick={() => handleSelect(editing)}
                    className="btn-secondary text-xs"
                  >
                    <Check size={13} />
                    Use This Style
                  </button>
                  {!editing.isBuiltIn && !isCreating && (
                    <button
                      onClick={() => handleDelete(editing.id)}
                      className="btn-danger text-xs ml-auto"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Preset List Item ─────────────────────────────────────────────────────────

function PresetListItem({
  preset,
  isSelected,
  isEditing,
  onEdit,
  onSelect,
  onSetDefault,
  onDelete,
}: {
  preset: BaseStylePreset;
  isSelected: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSelect: () => void;
  onSetDefault: () => void;
  onDelete: (() => void) | null;
}) {
  return (
    <div
      className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150
        ${isEditing
          ? 'bg-accent-purple/15 border border-accent-purple/30'
          : 'hover:bg-bg-elevated border border-transparent'
        }`}
      onClick={onEdit}
    >
      {/* Default star */}
      <button
        onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
        className={`flex-shrink-0 transition-colors ${preset.isDefault ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400'}`}
        title={preset.isDefault ? 'Default style' : 'Set as default'}
      >
        <Star size={11} fill={preset.isDefault ? 'currentColor' : 'none'} />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 truncate">{preset.name}</p>
        <p className="text-[10px] text-slate-600 truncate">{preset.aspectRatio}</p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isSelected && (
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Check size={9} className="text-emerald-400" />
          </div>
        )}
        {/* Use button */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="text-[10px] px-2 py-0.5 rounded bg-accent-purple/20 text-accent-purple-light border border-accent-purple/30 hover:bg-accent-purple/30 transition-colors"
        >
          Use
        </button>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
