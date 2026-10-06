'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Upload,
  ExternalLink,
  Sparkles,
  Loader2,
  Check,
  X,
  ImageIcon,
} from 'lucide-react';
import type { BaseStylePreset } from '@/types';
import { generateSceneImage } from '@/lib/pollinations';
import { uploadMediaToSupabaseStorage, isSupabaseConfigured } from '@/lib/supabase-service';
import { getPollinationsApiKey } from '@/lib/store';
import { CORE_FAMILIES } from '@/lib/style-taxonomy';

interface StyleEditModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialStyle: BaseStylePreset | null;
  defaultSortOrder: number;
  onClose: () => void;
  onSave: (style: BaseStylePreset) => Promise<unknown>;
  onFastUpdate: (updatedStyle: BaseStylePreset) => void;
  showToast: (msg: string) => void;
}

const PROMPT_BOOSTERS = [
  '35mm anamorphic',
  'photorealistic 8k',
  'chiaroscuro lighting',
  'film grain texture',
  'masterwork composition',
  'Kodak Vision3',
  'shallow depth of field',
  'cinematic color grading',
];

const NEGATIVE_CHIPS = [
  'plastic CGI',
  '3D render',
  'oversaturated cartoon',
  'blurry out of focus',
  'watermark text',
  'distorted faces',
  'flat digital art',
];

export function StyleEditModal({
  isOpen,
  isEditing,
  initialStyle,
  defaultSortOrder,
  onClose,
  onSave,
  onFastUpdate,
  showToast,
}: StyleEditModalProps) {
  // Form State (Left Column)
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formFamilyId, setFormFamilyId] = useState('cinematic');
  const [formTag, setFormTag] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStylePrompt, setFormStylePrompt] = useState('');
  const [formNegativePrompt, setFormNegativePrompt] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(100);
  const [formIsActive, setFormIsActive] = useState(true);

  // Live Test & Thumbnail State (Right Column)
  const [testGenerating, setTestGenerating] = useState(false);
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
  const [testImageBlob, setTestImageBlob] = useState<Blob | null>(null);
  const [testTimer, setTestTimer] = useState(0);
  const [settingThumbnail, setSettingThumbnail] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload & Direct URL State
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && initialStyle) {
      setFormId(initialStyle.id);
      setFormName(initialStyle.name);
      setFormFamilyId(initialStyle.familyId || 'cinematic');
      setFormTag(initialStyle.tag || '');
      setFormDescription(initialStyle.description || '');
      setFormStylePrompt(initialStyle.stylePrompt || '');
      setFormNegativePrompt(initialStyle.negativePrompt || '');
      setFormThumbnailUrl(initialStyle.thumbnailUrl || '');
      setCustomImageUrlInput(initialStyle.thumbnailUrl || '');
      setFormSortOrder(initialStyle.sortOrder ?? 100);
      setFormIsActive(initialStyle.isActive !== false);
      setTestImageUrl(initialStyle.thumbnailUrl || null);
    } else {
      setFormId(`style_${Date.now()}`);
      setFormName('');
      setFormFamilyId('cinematic');
      setFormTag('');
      setFormDescription('');
      setFormStylePrompt('');
      setFormNegativePrompt(
        'ugly, blurry, distorted faces, oversaturated cartoon, plastic smooth CGI, generic 3D render'
      );
      setFormThumbnailUrl(
        'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278399392_70mm_imax_photorealism.jpg'
      );
      setCustomImageUrlInput('');
      setFormSortOrder(defaultSortOrder);
      setFormIsActive(true);
      setTestImageUrl(null);
    }
    setTestImageBlob(null);
    setShowUrlInput(false);
  }, [isOpen, isEditing, initialStyle, defaultSortOrder]);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Add token enhancer to style prompt
  const appendPromptBooster = (booster: string) => {
    if (!formStylePrompt.toLowerCase().includes(booster.toLowerCase())) {
      setFormStylePrompt((prev) =>
        prev.trim() ? `${prev.trim().replace(/\.+$/, '')}, ${booster}` : booster
      );
    }
  };

  // Add exclusion chip to negative prompt
  const appendNegativeChip = (chip: string) => {
    if (!formNegativePrompt.toLowerCase().includes(chip.toLowerCase())) {
      setFormNegativePrompt((prev) =>
        prev.trim() ? `${prev.trim().replace(/\.+$/, '')}, ${chip}` : chip
      );
    }
  };

  // Handle Live Test Image Generation (Triggered from Left Column)
  const handleRunLiveTest = async () => {
    if (!formStylePrompt.trim()) {
      showToast('Please enter a style prompt to test.');
      return;
    }
    setTestGenerating(true);
    setTestTimer(0);
    const timerInterval = setInterval(() => {
      setTestTimer((prev) => prev + 1);
    }, 1000);

    try {
      // 1. Fetch authenticated Pollinations API key
      const apiKey = await getPollinationsApiKey();

      // 2. Generate test image using the style prompt & negative prompt directly
      const referenceSubject = 'A majestic ancient valley and cinematic temple ruins at golden hour, photorealistic 8k, masterwork composition';
      const arrayBuffer = await generateSceneImage(
        referenceSubject,
        formStylePrompt.trim(),
        undefined,
        {
          aspectRatio: '16:9',
          model: 'flux',
          negativePrompt: formNegativePrompt.trim() || undefined,
          apiKey: apiKey || undefined,
        }
      );

      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      setTestImageBlob(blob);
      if (testImageUrl && testImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(testImageUrl);
      }
      const url = URL.createObjectURL(blob);
      setTestImageUrl(url);
      showToast('✓ Test image generated!');
    } catch (err) {
      console.error('Test generation failed:', err);
      showToast('Test generation failed. Please try again.');
    } finally {
      clearInterval(timerInterval);
      setTestGenerating(false);
    }
  };

  // Set the current test image as thumbnail and save to DB
  const handleSetAsStyleThumbnail = async () => {
    if (!testImageUrl) return;
    setSettingThumbnail(true);

    try {
      let finalUrl = testImageUrl;

      // 1. Upload generated image Blob to Supabase Storage if configured
      if (testImageBlob && isSupabaseConfigured()) {
        const safeName = (formName || 'style').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const path = `styles/thumb_${Date.now()}_${safeName}.jpg`;
        const publicUrl = await uploadMediaToSupabaseStorage('scene-images', path, testImageBlob);
        if (publicUrl) {
          finalUrl = publicUrl;
        }
      }

      setFormThumbnailUrl(finalUrl);

      // 2. Persist updated style
      const targetId = formId || `style_${Date.now()}`;
      const styleToPersist: BaseStylePreset = {
        id: targetId,
        name: formName.trim() || 'Custom Art Style',
        familyId: formFamilyId,
        tag: formTag.trim(),
        description: formDescription.trim(),
        stylePrompt: formStylePrompt.trim(),
        negativePrompt: formNegativePrompt.trim() || undefined,
        thumbnailUrl: finalUrl,
        aspectRatio: '16:9',
        isDefault: false,
        isActive: formIsActive,
        sortOrder: Number(formSortOrder) || 100,
        createdAt: Date.now(),
      };

      await onSave(styleToPersist);
      showToast('✓ Set as thumbnail & saved to database!');
    } catch (err) {
      console.error('Failed to set thumbnail:', err);
      showToast('Error saving thumbnail');
    } finally {
      setSettingThumbnail(false);
    }
  };

  // Upload Image File directly
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    setUploadingImage(true);
    try {
      if (isSupabaseConfigured()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `styles/${Date.now()}_${safeName}`;
        const publicUrl = await uploadMediaToSupabaseStorage('scene-images', path, file);
        if (publicUrl) {
          setFormThumbnailUrl(publicUrl);
          setTestImageUrl(publicUrl);
          showToast('✓ Image uploaded and set as thumbnail!');
          setUploadingImage(false);
          return;
        }
      }

      // Local / Offline fallback: Base64 Data URL
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64Url = reader.result;
          setFormThumbnailUrl(base64Url);
          setTestImageUrl(base64Url);
          showToast('✓ Image loaded successfully!');
        }
        setUploadingImage(false);
      };
      reader.onerror = () => {
        showToast('Failed to read image file');
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Error uploading image');
      setUploadingImage(false);
    }
  };

  // Save Art Style (Primary Form Submit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Please enter a style name');
      return;
    }
    if (!formStylePrompt.trim()) {
      showToast('Please enter a style prompt');
      return;
    }

    setSaving(true);
    const updatedStyle: BaseStylePreset = {
      id: formId,
      name: formName.trim(),
      familyId: formFamilyId,
      tag: formTag.trim(),
      description: formDescription.trim(),
      stylePrompt: formStylePrompt.trim(),
      negativePrompt: formNegativePrompt.trim() || undefined,
      thumbnailUrl: formThumbnailUrl.trim() || undefined,
      aspectRatio: '16:9',
      isDefault: false,
      isActive: formIsActive,
      sortOrder: Number(formSortOrder) || 100,
      createdAt: Date.now(),
    };

    try {
      await onSave(updatedStyle);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const availableFamilies = CORE_FAMILIES.filter((f) => f.id !== 'all');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[880px] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* ── Top Header ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/90 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Palette size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-none">
                  {isEditing ? `Edit Style: ${formName || 'Untitled'}` : 'Create New Art Style'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {availableFamilies.find((f) => f.id === formFamilyId)?.name || formFamilyId}
                </span>
                {!formIsActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Visual Style DNA Architect · Authenticated FLUX HD Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer"
              />
              <span className="text-[11px] font-medium">{formIsActive ? 'Visible in Catalog' : 'Hidden'}</span>
            </label>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Main Split 2-Column Body ────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* ── Left Column: Form Fields & Test Button (60%) ── */}
          <div className="lg:col-span-7 overflow-y-auto p-6 space-y-5 border-r border-zinc-800/80 custom-scrollbar flex flex-col justify-between">
            <div className="space-y-4">
              {/* Identity & Taxonomy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Style Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. 70mm IMAX Photorealism"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Core Family <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formFamilyId}
                    onChange={(e) => setFormFamilyId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                  >
                    {availableFamilies.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.tagline})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Movement / Badge Tag
                  </label>
                  <input
                    type="text"
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value)}
                    placeholder="e.g. Ultra-High Clarity"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Sort Order Priority
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Short Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Pristine 8K documentary cinematography, natural lighting, exceptional realism, IMAX standard."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Visual Style Prompt DNA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-400" />
                    Visual Style Prompt (DNA Anchor) <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {formStylePrompt.length} characters
                  </span>
                </div>

                <textarea
                  rows={4}
                  required
                  value={formStylePrompt}
                  onChange={(e) => setFormStylePrompt(e.target.value)}
                  placeholder="e.g. 70mm IMAX documentary cinematography, photorealistic 8k, pristine optical clarity, natural balanced lighting, subtle cinematic depth of field, authentic real-world textures, masterwork composition, shot on Panavision 70mm lens"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-purple-200 font-mono leading-relaxed focus:outline-none focus:border-purple-500 transition-colors"
                />

                {/* 1-Click Prompt Enhancers */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                    1-Click Token Enhancers:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_BOOSTERS.map((booster) => (
                      <button
                        key={booster}
                        type="button"
                        onClick={() => appendPromptBooster(booster)}
                        className="px-2 py-1 rounded-lg bg-zinc-800/80 hover:bg-purple-900/40 hover:text-purple-200 border border-zinc-700/60 hover:border-purple-500/40 text-[10px] text-zinc-300 font-medium transition-colors"
                      >
                        + {booster}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Anti-Slop Negative Shield Prompt */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Anti-Slop Negative Shield Prompt
                </label>
                <textarea
                  rows={2}
                  value={formNegativePrompt}
                  onChange={(e) => setFormNegativePrompt(e.target.value)}
                  placeholder="e.g. cartoon, anime, 3D render, CGI, glossy, blurry, distorted faces, low resolution, oversaturated, text, watermark, signature"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-rose-300/90 font-mono focus:outline-none focus:border-purple-500 transition-colors"
                />

                {/* 1-Click Negative Exclusion Chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {NEGATIVE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => appendNegativeChip(chip)}
                      className="px-2 py-1 rounded-lg bg-zinc-800/60 hover:bg-rose-950/40 hover:text-rose-200 border border-zinc-800 hover:border-rose-500/40 text-[10px] text-zinc-400 font-medium transition-colors"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Test Prompt Button (Bottom of Left Column) ── */}
            <div className="pt-4 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleRunLiveTest}
                disabled={testGenerating || !formStylePrompt.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50"
              >
                {testGenerating ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-purple-200" />
                    <span>Rendering Test Sample ({testTimer}s)…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Test Prompt (Generate Live FLUX HD Sample)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Right Column: Image Preview & Save as Thumbnail (40%) ── */}
          <div className="lg:col-span-5 overflow-y-auto p-6 space-y-5 bg-zinc-950/60 custom-scrollbar flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-purple-400" /> Style Thumbnail & Preview
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  FLUX HD Output
                </span>
              </div>

              {/* Large Image Canvas */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-lg">
                {testGenerating ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 p-6 text-center">
                    <Loader2 size={26} className="animate-spin text-purple-400" />
                    <p className="text-xs font-medium text-zinc-300">Rendering high-definition 1080p sample...</p>
                    <p className="text-[10px] text-zinc-500">Using authenticated FLUX HD Engine ({testTimer}s)</p>
                  </div>
                ) : testImageUrl ? (
                  <img
                    src={testImageUrl}
                    alt="Style Output Preview"
                    className="w-full h-full object-cover"
                  />
                ) : formThumbnailUrl ? (
                  <img
                    src={formThumbnailUrl}
                    alt="Current Style Thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 text-zinc-600">
                    <ImageIcon size={36} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-medium text-zinc-400">No Image Available</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Click "Test Prompt" on the left to generate one</p>
                  </div>
                )}
              </div>

              {/* Save as Style Thumbnail Button (shown when test image exists) */}
              {testImageUrl && testImageUrl !== formThumbnailUrl && (
                <button
                  type="button"
                  onClick={handleSetAsStyleThumbnail}
                  disabled={settingThumbnail}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-950 transition-all disabled:opacity-50 animate-in fade-in"
                >
                  {settingThumbnail ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving Thumbnail to DB...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Set as Style Thumbnail & Save to DB</span>
                    </>
                  )}
                </button>
              )}

              {/* Upload or URL Controls */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Or Use Custom Image:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Upload size={12} /> {uploadingImage ? 'Uploading...' : 'Upload File'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={12} /> Image URL
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />

                {showUrlInput && (
                  <div className="flex gap-2 animate-in fade-in">
                    <input
                      type="url"
                      value={customImageUrlInput}
                      onChange={(e) => setCustomImageUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customImageUrlInput.trim()) {
                          setFormThumbnailUrl(customImageUrlInput.trim());
                          setTestImageUrl(customImageUrlInput.trim());
                          showToast('✓ Thumbnail URL applied');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Status Footer */}
            <div className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
              <span>Aspect Ratio: 16:9 Widescreen</span>
              {formThumbnailUrl ? (
                <span className="text-emerald-400 font-medium">✓ Thumbnail Assigned</span>
              ) : (
                <span className="text-zinc-500">No Thumbnail</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Fixed Bottom Footer ────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/95 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="font-mono text-[10px] text-zinc-500">ID: {formId}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !formName.trim() || !formStylePrompt.trim()}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Saving Style...
                </>
              ) : (
                <>
                  <Check size={13} /> Save Art Style
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
