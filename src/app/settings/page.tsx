'use client';

import { useState, useEffect } from 'react';
import { Key, CheckCircle, Loader2, Eye, EyeOff, Sparkles, Palette, RotateCcw } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import {
  getPollinationsApiKey,
  savePollinationsApiKey,
  getPollinationsImageModel,
  savePollinationsImageModel,
  getGlobalBaseStylePrompt,
  saveGlobalBaseStylePrompt,
  getGlobalNegativePrompt,
  saveGlobalNegativePrompt,
  DEFAULT_BASE_STYLE_PROMPT,
  DEFAULT_NEGATIVE_PROMPT,
} from '@/lib/store';
import { POPULAR_POLLINATIONS_MODELS } from '@/lib/pollinations';

const STYLE_SHORTCUTS = [
  {
    name: 'Cinematic 8K',
    prompt: 'Photorealistic, cinematic lighting, 8k resolution, muted color palette, high-end documentary look, shot on 35mm anamorphic lens, dramatic shadows, film grain',
    neg: 'cartoon, anime, blurry, distorted faces, low resolution, CGI, oversaturated',
  },
  {
    name: 'Studio Ghibli / Anime',
    prompt: 'High-quality anime illustration, detailed hand-drawn style, vibrant colors, clean linework, dramatic lighting, Studio Ghibli inspired',
    neg: 'realistic, photograph, 3D render, blurry, watermark, text',
  },
  {
    name: 'Cyberpunk Neon',
    prompt: 'Futuristic cyberpunk aesthetic, neon lights, rain-slicked streets, ultra-detailed digital art, volumetric fog, holographic displays, blade runner style',
    neg: 'daylight, natural, countryside, low tech, sketch, watermark',
  },
  {
    name: 'Pixar / 3D Animation',
    prompt: '3D Pixar and Disney animation render style, expressive lighting, soft subsurface scattering, vibrant stylized textures, Octane 3D render',
    neg: 'photorealistic, live action, flat, grainy, distorted',
  },
  {
    name: 'Vintage Oil Painting',
    prompt: 'Rich oil painting, impressionist style, visible textured brushstrokes, warm golden lighting, classical fine art museum quality',
    neg: 'digital, modern, photograph, neon, flat vector',
  },
  {
    name: 'Minimalist Vector',
    prompt: 'Modern 2D flat vector design illustration, bold clean geometric shapes, minimalist shadows, corporate explainer video aesthetic',
    neg: 'photograph, realistic, 3D, dark, gritty, complex textures',
  },
];

export default function SettingsPage() {
  const [pollinationsKey, setPollinationsKey] = useState('');
  const [savedPollinationsKey, setSavedPollinationsKey] = useState('');
  const [savingPol, setSavingPol] = useState(false);
  const [savedPol, setSavedPol] = useState(false);
  const [showPolKey, setShowPolKey] = useState(false);

  const [imageModel, setImageModel] = useState('flux');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_savedImageModel, setSavedImageModel] = useState('flux');
  const [savedModelToast, setSavedModelToast] = useState(false);

  // Global Image Base-Style State
  const [baseStylePrompt, setBaseStylePrompt] = useState(DEFAULT_BASE_STYLE_PROMPT);
  const [savedBaseStylePrompt, setSavedBaseStylePrompt] = useState(DEFAULT_BASE_STYLE_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);
  const [savedNegativePrompt, setSavedNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);
  const [savingBaseStyle, setSavingBaseStyle] = useState(false);
  const [savedBaseStyleToast, setSavedBaseStyleToast] = useState(false);

  useEffect(() => {
    getPollinationsApiKey().then((k) => {
      setPollinationsKey(k);
      setSavedPollinationsKey(k);
    });
    getPollinationsImageModel().then((m) => {
      setImageModel(m);
      setSavedImageModel(m);
    });
    getGlobalBaseStylePrompt().then((p) => {
      setBaseStylePrompt(p);
      setSavedBaseStylePrompt(p);
    });
    getGlobalNegativePrompt().then((n) => {
      setNegativePrompt(n);
      setSavedNegativePrompt(n);
    });
  }, []);

  async function handleSaveBaseStyle() {
    setSavingBaseStyle(true);
    await saveGlobalBaseStylePrompt(baseStylePrompt.trim());
    await saveGlobalNegativePrompt(negativePrompt.trim());
    setSavedBaseStylePrompt(baseStylePrompt.trim());
    setSavedNegativePrompt(negativePrompt.trim());
    setSavingBaseStyle(false);
    setSavedBaseStyleToast(true);
    setTimeout(() => setSavedBaseStyleToast(false), 2000);
  }

  function handleResetBaseStyle() {
    setBaseStylePrompt(DEFAULT_BASE_STYLE_PROMPT);
    setNegativePrompt(DEFAULT_NEGATIVE_PROMPT);
  }

  function handleApplyShortcut(preset: typeof STYLE_SHORTCUTS[0]) {
    setBaseStylePrompt(preset.prompt);
    setNegativePrompt(preset.neg);
  }

  const isBaseStyleDirty =
    baseStylePrompt.trim() !== savedBaseStylePrompt.trim() ||
    negativePrompt.trim() !== savedNegativePrompt.trim();

  async function handleImageModelChange(newModel: string) {
    setImageModel(newModel);
    await savePollinationsImageModel(newModel);
    setSavedImageModel(newModel);
    setSavedModelToast(true);
    setTimeout(() => setSavedModelToast(false), 2000);
  }

  async function handleSavePollinations() {
    setSavingPol(true);
    await savePollinationsApiKey(pollinationsKey.trim());
    setSavedPollinationsKey(pollinationsKey.trim());
    setSavingPol(false);
    setSavedPol(true);
    setTimeout(() => setSavedPol(false), 2000);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure Pollinations AI models, visual base-styles, and preferences</p>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl space-y-6 animate-slide-up">

            {/* Pollinations Configuration Card */}
            <div className="card">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                  <Key size={16} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Pollinations AI{' '}
                    <span className="text-[11px] font-normal text-emerald-400 font-mono">(Free by Default)</span>
                  </h2>
                  <p className="text-xs text-slate-500">Powers script splitting, scene extraction, voices, and image rendering</p>
                </div>
              </div>

              {/* API Key Input (Optional) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Pollinations API Key (Optional)</label>
                  <span className="text-[11px] text-slate-500">Only needed for Pro models</span>
                </div>
                <div className="relative">
                  <input
                    id="pollinations-key-input"
                    type={showPolKey ? 'text' : 'password'}
                    value={pollinationsKey}
                    onChange={(e) => setPollinationsKey(e.target.value)}
                    placeholder="Enter Pollinations API key or leave blank for free models"
                    className="input pr-10 font-mono text-xs"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPolKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPolKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Free models require no key. Optional keys can be generated at{' '}
                  <span
                    className="text-cyan-400 cursor-pointer hover:underline"
                    onClick={() => window.open('https://enter.pollinations.ai/keys', '_blank')}
                  >
                    enter.pollinations.ai/keys
                  </span>
                  .
                </p>
              </div>

              {/* Preferred Image Model Selector */}
              <div className="pt-4 mt-4 border-t border-bg-border/60 mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-purple-400" />
                    Pollinations Image Model
                  </label>
                  {savedModelToast && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 animate-fade-in">
                      <CheckCircle size={11} /> Saved
                    </span>
                  )}
                </div>
                <select
                  id="pollinations-image-model-select"
                  value={imageModel}
                  onChange={(e) => handleImageModelChange(e.target.value)}
                  className="input text-xs"
                >
                  {POPULAR_POLLINATIONS_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.description}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Model used across Storyboard &amp; Images-Only mode via <code className="text-purple-300 font-mono text-[10px]">https://gen.pollinations.ai/image/&#123;prompt&#125;</code>
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  id="save-pollinations-key-btn"
                  onClick={handleSavePollinations}
                  disabled={savingPol || pollinationsKey.trim() === savedPollinationsKey}
                  className="btn-secondary px-6"
                >
                  {savingPol ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : savedPol ? (
                    <CheckCircle size={14} />
                  ) : null}
                  {savedPol ? 'Saved!' : 'Save Pollinations Key'}
                </button>
              </div>
            </div>

            {/* Image Generation Base-Style Card */}
            <div className="card">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                    <Palette size={16} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">Image Generation Base-Style</h2>
                      <span className="text-[10px] text-purple-400 bg-purple-950/60 border border-purple-800/40 px-1.5 py-0.5 rounded font-mono">
                        Global
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Default visual aesthetic &amp; styling applied to every scene image
                    </p>
                  </div>
                </div>

                {savedBaseStyleToast && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 animate-fade-in">
                    <CheckCircle size={13} /> Base style saved!
                  </span>
                )}
              </div>

              {/* Quick Preset Selector Chips */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                  Quick Style Presets (Click to Load)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_SHORTCUTS.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => handleApplyShortcut(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        baseStylePrompt === s.prompt
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                          : 'bg-bg-base/60 border-bg-border text-slate-400 hover:text-white hover:bg-bg-elevated'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base Style Prompt Textarea */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Base Style Prompt</label>
                  <span className="text-[11px] text-slate-500">Appended to each scene visual prompt</span>
                </div>
                <textarea
                  id="base-style-prompt-input"
                  rows={3}
                  value={baseStylePrompt}
                  onChange={(e) => setBaseStylePrompt(e.target.value)}
                  placeholder="e.g. Photorealistic, cinematic lighting, 8k resolution, 35mm lens, atmospheric shadows..."
                  className="input font-mono text-xs resize-y min-h-[70px] leading-relaxed"
                />
              </div>

              {/* Negative Prompt Input */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Negative Prompt (Things to Avoid)</label>
                  <span className="text-[11px] text-slate-500">Excluded elements</span>
                </div>
                <input
                  id="negative-prompt-input"
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="e.g. blurry, distorted faces, low resolution, CGI, cartoon, watermark..."
                  className="input font-mono text-xs"
                />
              </div>

              {/* Live Preview Box */}
              <div className="p-3 rounded-lg bg-bg-base/70 border border-bg-border text-xs mb-5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                  How Image Prompts Will Be Formed:
                </span>
                <p className="text-slate-300 font-mono text-[11px] leading-relaxed">
                  <span className="text-cyan-400">[Scene visual description]</span>
                  <span className="text-slate-500">. </span>
                  <span className="text-purple-300">{baseStylePrompt || '(No base style prompt)'}</span>
                </p>
                {negativePrompt && (
                  <p className="text-slate-400 font-mono text-[10px] mt-1 pt-1 border-t border-bg-border/50">
                    <span className="text-red-400">Avoid: </span>
                    <span className="text-slate-400">{negativePrompt}</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetBaseStyle}
                  className="btn-secondary text-xs"
                  title="Reset to default cinematic 8k base style"
                >
                  <RotateCcw size={12} />
                  Reset to Default
                </button>

                <button
                  id="save-base-style-btn"
                  type="button"
                  onClick={handleSaveBaseStyle}
                  disabled={savingBaseStyle || !isBaseStyleDirty}
                  className="btn-primary px-6"
                >
                  {savingBaseStyle ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : savedBaseStyleToast ? (
                    <CheckCircle size={14} />
                  ) : (
                    <Palette size={14} />
                  )}
                  {savedBaseStyleToast ? 'Saved!' : 'Save Base Style'}
                </button>
              </div>
            </div>

            {/* Info Card */}
            <div className="card-elevated border-bg-border/50">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">AI Engine Status</h3>
              <div className="space-y-2">
                {[
                  { label: 'Script Chunking & Parsing', model: 'Pollinations AI (Semantic Chunker)', color: 'text-blue-400' },
                  { label: 'Scene Extraction & Visual Prompts', model: 'Pollinations AI (Scene Extractor)', color: 'text-indigo-400' },
                  { label: 'Voice Generation (TTS)', model: 'Pollinations Audio (TTS)', color: 'text-accent-purple-light' },
                  { label: 'Image Engine', model: `Pollinations AI (${imageModel})`, color: 'text-purple-400' },
                ].map(({ label, model, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-mono ${color}`}>{model}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
