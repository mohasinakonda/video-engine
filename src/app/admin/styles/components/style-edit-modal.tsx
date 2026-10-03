'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Upload,
  Trash2,
  ExternalLink,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';
import type { BaseStylePreset } from '@/types';
import { generateSceneImage } from '@/lib/pollinations';
import { uploadMediaToSupabaseStorage, isSupabaseConfigured } from '@/lib/supabase-service';

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
  // Form State
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

  // Upload & URL State
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Test Generator State
  const [testGenerating, setTestGenerating] = useState(false);
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
  const [testImageBlob, setTestImageBlob] = useState<Blob | null>(null);
  const [settingThumbnail, setSettingThumbnail] = useState(false);
  const [testSubject, setTestSubject] = useState(
    'An ancient stone temple wrapped in misty jungle vines at golden hour'
  );
  const [saving, setSaving] = useState(false);

  // Reset or fill form when modal opens
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
        'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80'
      );
      setFormSortOrder(defaultSortOrder);
      setFormIsActive(true);
      setTestImageUrl(null);
    }
    setTestImageBlob(null);
    setShowUrlInput(false);
  }, [isOpen, isEditing, initialStyle, defaultSortOrder]);

  if (!isOpen) return null;

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
          if (isEditing && formId) {
            onFastUpdate({
              id: formId,
              name: formName,
              familyId: formFamilyId,
              stylePrompt: formStylePrompt,
              thumbnailUrl: publicUrl,
              aspectRatio: '16:9',
              isDefault: false,
              isActive: formIsActive,
              createdAt: Date.now(),
            });
          }
          showToast('Image uploaded and preview updated!');
          setUploadingImage(false);
          return;
        }
      }

      // Local / Offline fallback: Convert to Base64 Data URL
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64Url = reader.result;
          setFormThumbnailUrl(base64Url);
          if (isEditing && formId) {
            onFastUpdate({
              id: formId,
              name: formName,
              familyId: formFamilyId,
              stylePrompt: formStylePrompt,
              thumbnailUrl: base64Url,
              aspectRatio: '16:9',
              isDefault: false,
              isActive: formIsActive,
              createdAt: Date.now(),
            });
          }
          showToast('Image loaded successfully!');
        }
        setUploadingImage(false);
      };
      reader.onerror = () => {
        showToast('Failed to read image file');
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast('Error uploading image');
      setUploadingImage(false);
    }
  };

  const handleRunLiveTest = async () => {
    if (!formStylePrompt.trim()) {
      alert('Please enter a style prompt to test.');
      return;
    }
    setTestGenerating(true);
    try {
      const arrayBuffer = await generateSceneImage(testSubject, formStylePrompt, undefined, {
        aspectRatio: '16:9',
        model: 'flux',
        negativePrompt: formNegativePrompt || undefined,
      });
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      setTestImageBlob(blob);
      const url = URL.createObjectURL(blob);
      setTestImageUrl(url);
    } catch (err) {
      console.error('Test generation failed:', err);
      alert('Test generation failed. Please try again.');
    } finally {
      setTestGenerating(false);
    }
  };

  const handleSetAsStyleThumbnail = async () => {
    if (!testImageUrl) return;
    setSettingThumbnail(true);

    try {
      let finalUrl = testImageUrl;

      // 1. Upload generated image Blob to Supabase Storage scene-images bucket
      if (testImageBlob && isSupabaseConfigured()) {
        const safeName = (formName || 'style').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const path = `styles/thumb_${Date.now()}_${safeName}.jpg`;
        const publicUrl = await uploadMediaToSupabaseStorage('scene-images', path, testImageBlob);
        if (publicUrl) {
          finalUrl = publicUrl;
        }
      }

      setFormThumbnailUrl(finalUrl);

      // 2. Immediately save & sync to Supabase Database and localStorage via onSave
      const targetId = formId || `style_${Date.now()}`;
      const styleToPersist: BaseStylePreset = {
        id: targetId,
        name: (formName || 'New Art Style').trim(),
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
    } catch (err) {
      console.error('Failed to set thumbnail:', err);
      showToast('Error uploading thumbnail');
    } finally {
      setSettingThumbnail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formStylePrompt.trim()) {
      alert('Please provide a Style Name and Style Prompt.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 my-8 shadow-2xl animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Palette size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? `Edit Style: ${formName}` : 'Add New Art Style'}
              </h2>
              <p className="text-xs text-zinc-400">
                Configure prompt DNA, visual thumbnail, and live test output
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Style Name *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 35mm Anamorphic Cinema"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Core Family *
              </label>
              <select
                value={formFamilyId}
                onChange={(e) => setFormFamilyId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="cinematic">Cinematic Film</option>
                <option value="printmaking">Print & Relief</option>
                <option value="animation">Animation & Anime</option>
                <option value="painting">Fine Art Painting</option>
                <option value="graphic">Graphic & Conceptual</option>
                <option value="vintage">Vintage & Historical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Tag / Movement Name
              </label>
              <input
                type="text"
                value={formTag}
                onChange={(e) => setFormTag(e.target.value)}
                placeholder="e.g. 1970s Panavision"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
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
              placeholder="e.g. Authentic anamorphic lens flare, Kodak Vision3 500T grain and warm tones"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Style Prompt */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Visual Style Prompt (DNA Anchor) *
            </label>
            <textarea
              rows={4}
              required
              value={formStylePrompt}
              onChange={(e) => setFormStylePrompt(e.target.value)}
              placeholder="e.g. shot on 35mm anamorphic lens, Panavision C-Series, organic film grain, Kodak Vision3 500T stock, cinematic soft roll-off, cinematic contrast"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Negative Shield Prompt */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Anti-Slop Negative Shield Prompt
            </label>
            <input
              type="text"
              value={formNegativePrompt}
              onChange={(e) => setFormNegativePrompt(e.target.value)}
              placeholder="e.g. plastic smooth skin, CGI 3D render, oversaturated cartoon, flat digital look"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Thumbnail Image: Upload & URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Style Thumbnail Image
              </label>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showUrlInput ? 'Switch to File Upload' : 'or enter Image URL'}
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />

            {formThumbnailUrl ? (
              <div className="space-y-2">
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 group">
                  <img
                    src={formThumbnailUrl}
                    alt="Style Thumbnail Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors"
                    >
                      <Upload size={13} /> {uploadingImage ? 'Uploading...' : 'Replace File'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormThumbnailUrl('')}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>

                {showUrlInput && (
                  <div className="flex gap-2 animate-in fade-in">
                    <input
                      type="url"
                      value={formThumbnailUrl}
                      onChange={(e) => setFormThumbnailUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                    <a
                      href={formThumbnailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>
            ) : showUrlInput ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formThumbnailUrl}
                  onChange={(e) => setFormThumbnailUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-800 hover:border-purple-500/60 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-zinc-950/40 hover:bg-purple-500/5 group"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  {uploadingImage ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                </div>
                <p className="text-xs font-semibold text-zinc-300">
                  {uploadingImage
                    ? 'Uploading image...'
                    : 'Click to upload style image from computer'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  PNG, JPG, WebP supported (16:9 recommended)
                </p>
              </div>
            )}
          </div>

          {/* Live Test Playground */}
          <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Sparkles size={14} /> Live AI Test Generator
              </span>
              <button
                type="button"
                onClick={handleRunLiveTest}
                disabled={testGenerating || !formStylePrompt.trim()}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {testGenerating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> Test Prompt
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              placeholder="Test scene subject..."
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
            />

            {testImageUrl && (
              <div className="space-y-2 pt-2">
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-zinc-800">
                  <img
                    src={testImageUrl}
                    alt="Test Output"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSetAsStyleThumbnail}
                  disabled={settingThumbnail}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition-all disabled:opacity-50"
                >
                  {settingThumbnail ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Uploading & Saving to DB...
                    </>
                  ) : (
                    <>
                      <Check size={13} /> Set as Style Thumbnail & Save to DB
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="formIsActive"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-0"
            />
            <label htmlFor="formIsActive" className="text-xs text-zinc-300 font-medium">
              Active (Display this style to creators in the project builder)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-900/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Art Style'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
