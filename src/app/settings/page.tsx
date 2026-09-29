'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Palette,
  RotateCcw,
  CheckCircle,
  Loader2,
  Camera,
  SunMedium,
  ShieldAlert,
  Wand2,
  Copy,
  Plus,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  getPollinationsImageModel,
  savePollinationsImageModel,
  getGlobalBaseStylePrompt,
  saveGlobalBaseStylePrompt,
  getGlobalNegativePrompt,
  saveGlobalNegativePrompt,
  DEFAULT_BASE_STYLE_PROMPT,
  DEFAULT_NEGATIVE_PROMPT,
} from '@/lib/store';
import {
  POPULAR_POLLINATIONS_MODELS,
  enhanceScenePrompt,
  type EnhancedScenePromptResult,
} from '@/lib/pollinations';
import type { ShotType } from '@/types';

const STYLE_SHORTCUTS = [
  {
    name: 'Cinematic 8K',
    description: 'Photorealistic, cinematic lighting, 8k resolution, 35mm anamorphic lens, film grain',
    prompt: 'Photorealistic, cinematic lighting, 8k resolution, muted color palette, high-end documentary look, shot on 35mm anamorphic lens, dramatic shadows, film grain',
    neg: 'cartoon, anime, blurry, distorted faces, low resolution, CGI, oversaturated',
  },
  {
    name: 'Conceptual Illustration',
    description: 'Linocut & relief print on warm archival cream paper with symbolic visual metaphor',
    prompt:
      'Conceptual illustration in a traditional hand-carved linocut and relief-print style printed on warm textured off-white archival paper (#F1E7D0). Hand-carved woodblock aesthetic with rough irregular carved edges, visible ink texture, coarse paper grain, organic cross-hatching, stippling and dot patterns, carved negative space details, and expressive silhouettes. Strict limited print palette: warm aged ivory cream paper, deep charcoal-green primary ink (#17251F), muted forest green (#486044), dusty sage olive (#718064), and muted terracotta peach sky (#D98267) with faded peach highlights (#E9B49A). Tonal transitions rendered exclusively via halftone dots, stippling, and carved line density without smooth digital gradients. Poetic visual metaphor and symbolic transformation connecting subject with landscape, layered rolling hills, foliage motifs, and hidden narrative details. Print-based chiaroscuro with strong silhouettes and exposed cream paper highlights. Subtle vintage aged paper border, museum-quality editorial relief art print',
    neg: 'photorealism, 3D render, CGI, glossy digital illustration, smooth vector gradients, plastic textures, modern UI, neon colors, oversaturated, pure white, pure black, blurry, text, watermark, bad anatomy',
  },
  {
    name: 'Studio Ghibli / Anime',
    description: 'Hand-drawn anime illustration, clean linework, vibrant colors, dramatic lighting',
    prompt: 'High-quality anime illustration, detailed hand-drawn style, vibrant colors, clean linework, dramatic lighting, Studio Ghibli inspired',
    neg: 'realistic, photograph, 3D render, blurry, watermark, text',
  },
  {
    name: 'Cyberpunk Neon',
    description: 'Futuristic aesthetic, rain-slicked streets, volumetric fog, holographic neon',
    prompt: 'Futuristic cyberpunk aesthetic, neon lights, rain-slicked streets, ultra-detailed digital art, volumetric fog, holographic displays, blade runner style',
    neg: 'daylight, natural, countryside, low tech, sketch, watermark',
  },
  {
    name: 'Pixar / 3D Animation',
    description: '3D animated render, subsurface scattering, expressive lighting, Octane render',
    prompt: '3D Pixar and Disney animation render style, expressive lighting, soft subsurface scattering, vibrant stylized textures, Octane 3D render',
    neg: 'photorealistic, live action, flat, grainy, distorted',
  },
  {
    name: 'Vintage Oil Painting',
    description: 'Impressionist oil painting, visible brushstrokes, warm golden lighting',
    prompt: 'Rich oil painting, impressionist style, visible textured brushstrokes, warm golden lighting, classical fine art museum quality',
    neg: 'digital, modern, photograph, neon, flat vector',
  },
  {
    name: 'Minimalist Vector',
    description: 'Modern 2D flat design, geometric clean shapes, corporate explainer aesthetic',
    prompt: 'Modern 2D flat vector design illustration, bold clean geometric shapes, minimalist shadows, corporate explainer video aesthetic',
    neg: 'photograph, realistic, 3D, dark, gritty, complex textures',
  },
];

const LIGHTING_MODIFIERS = [
  { name: 'Golden Hour', value: 'warm golden hour sunbeams, soft volumetric rim light, rich amber horizon' },
  { name: 'Chiaroscuro', value: 'dramatic chiaroscuro lighting, deep velvety shadows, single high-contrast key light' },
  { name: 'Volumetric Mist', value: 'ethereal volumetric fog, diffused cool atmospheric light, subtle shafts of morning rays' },
  { name: 'Cyberpunk Neon', value: 'vibrant neon reflections, rain-slicked ground, moody contrasting cyan and magenta glow' },
  { name: 'Studio Softbox', value: 'balanced commercial studio lighting, soft diffused highlights, clean shadow roll-off' },
  { name: 'Moody Overcast', value: 'soft overcast daylight, desaturated cinematic palette, gentle even illumination' },
];

const CAMERA_MODIFIERS = [
  { name: '35mm Anamorphic', value: 'shot on 35mm anamorphic cinema lens, natural film grain, shallow depth of field' },
  { name: '85mm Portrait Bokeh', value: '85mm f/1.4 prime lens, creamy background bokeh, ultra-sharp subject isolation' },
  { name: '90° Drone Overhead', value: 'top-down 90-degree bird\'s-eye drone vantage point, geometric topographical scale' },
  { name: '100mm Macro Detail', value: 'extreme 100mm tactile macro close-up, razor-sharp focus on microscopic surface textures' },
  { name: '24mm Wide Vista', value: 'sweeping panoramic 24mm wide angle vista, balanced rule-of-thirds composition' },
  { name: 'Low-Angle Hero', value: 'dramatic low-angle perspective, monumental architectural presence, strong silhouettes' },
];

const COMMON_NEGATIVE_TAGS = [
  'distorted hands & limbs',
  'bad anatomy',
  'extra fingers',
  'watermark & text',
  'blurry low-res',
  'CGI plastic skin',
  'oversaturated',
  'grainy artifacts',
  'cropped faces',
  'amateur framing',
];

export default function SettingsPage() {
  const [imageModel, setImageModel] = useState('flux');
  const [savedModelToast, setSavedModelToast] = useState(false);

  // Global Image Base-Style State
  const [baseStylePrompt, setBaseStylePrompt] = useState(DEFAULT_BASE_STYLE_PROMPT);
  const [savedBaseStylePrompt, setSavedBaseStylePrompt] = useState(DEFAULT_BASE_STYLE_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);
  const [savedNegativePrompt, setSavedNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);
  const [savingBaseStyle, setSavingBaseStyle] = useState(false);
  const [savedBaseStyleToast, setSavedBaseStyleToast] = useState(false);

  // Playground / Enhancer Tester State
  const [testInput, setTestInput] = useState('A solitary wooden boat floating on a serene mountain lake at sunrise');
  const [testShotType, setTestShotType] = useState<ShotType>('WIDE_ESTABLISHING');
  const [selectedLighting, setSelectedLighting] = useState(LIGHTING_MODIFIERS[0].value);
  const [selectedCamera, setSelectedCamera] = useState(CAMERA_MODIFIERS[0].value);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedResult, setEnhancedResult] = useState<EnhancedScenePromptResult | null>(null);
  const [copiedEnhanced, setCopiedEnhanced] = useState(false);

  useEffect(() => {
    getPollinationsImageModel().then((m) => {
      setImageModel(m);
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

  function handleSelectStyleDropdown(val: string) {
    const found = STYLE_SHORTCUTS.find((s) => s.name === val);
    if (found) {
      setBaseStylePrompt(found.prompt);
      setNegativePrompt(found.neg);
    }
  }

  function handleToggleNegativeTag(tag: string) {
    const cleanTag = tag.trim().toLowerCase();
    const current = negativePrompt.toLowerCase();
    if (current.includes(cleanTag)) {
      // Remove tag
      const updated = negativePrompt
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.toLowerCase() !== cleanTag)
        .join(', ');
      setNegativePrompt(updated);
    } else {
      // Append tag
      const trimmed = negativePrompt.trim();
      const updated = trimmed.length > 0 ? `${trimmed}, ${tag}` : tag;
      setNegativePrompt(updated);
    }
  }

  function handleAppendModifier(text: string) {
    if (baseStylePrompt.toLowerCase().includes(text.toLowerCase().slice(0, 20))) return;
    const separator = baseStylePrompt.trim().endsWith('.') ? ' ' : ', ';
    setBaseStylePrompt(`${baseStylePrompt.trim()}${separator}${text}`);
  }

  async function handleImageModelChange(newModel: string) {
    setImageModel(newModel);
    await savePollinationsImageModel(newModel);
    setSavedModelToast(true);
    setTimeout(() => setSavedModelToast(false), 2000);
  }

  async function handleRunEnhancementTest() {
    if (!testInput.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const res = await enhanceScenePrompt(testInput, {
        shotType: testShotType,
        stylePrompt: baseStylePrompt,
        lightingModifier: selectedLighting,
        cameraLens: selectedCamera,
      });
      setEnhancedResult(res);
    } catch (err) {
      console.error('Enhancement test failed:', err);
    } finally {
      setIsEnhancing(false);
    }
  }

  function handleCopyEnhancedPrompt() {
    if (!enhancedResult) return;
    const finalPrompt = `${enhancedResult.visual_prompt}. ${baseStylePrompt}, avoid: ${negativePrompt}`;
    navigator.clipboard.writeText(finalPrompt);
    setCopiedEnhanced(true);
    setTimeout(() => setCopiedEnhanced(false), 2000);
  }

  const matchingPreset = STYLE_SHORTCUTS.find(
    (s) => s.prompt.trim() === baseStylePrompt.trim()
  );
  const selectedStyleValue = matchingPreset ? matchingPreset.name : 'custom';

  const isBaseStyleDirty =
    baseStylePrompt.trim() !== savedBaseStylePrompt.trim() ||
    negativePrompt.trim() !== savedNegativePrompt.trim();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-base">
      {/* Header */}
      <header className="px-8 py-5 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wand2 size={20} className="text-cyan-400" />
            Scene Generation &amp; Prompt Studio
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure image AI models, visual base aesthetics, camera/lighting modifiers, and test prompt enhancements
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl space-y-6 mx-auto animate-slide-up">

          {/* 1. Retained AI Image Model Selector Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                  <Sparkles size={16} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">AI Image Generation Model</h2>
                  <p className="text-xs text-slate-500">
                    Active diffusion engine powering scene frame rendering
                  </p>
                </div>
              </div>

              {savedModelToast && (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 animate-fade-in font-mono">
                  <CheckCircle size={13} /> Model saved!
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="pollinations-image-model-select" className="text-xs font-semibold text-slate-300">
                  Select Preferred Image Engine
                </label>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Active: <strong className="text-zinc-200">{imageModel}</strong>
                </span>
              </div>
              <select
                id="pollinations-image-model-select"
                value={imageModel}
                onChange={(e) => handleImageModelChange(e.target.value)}
                className="input text-xs font-medium cursor-pointer"
              >
                {POPULAR_POLLINATIONS_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Interactive Prompt Enhancement Playground */}
          <div className="card border-cyan-500/30 bg-gradient-to-b from-cyan-950/10 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Wand2 size={16} className="text-cyan-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">Interactive Prompt Enhancement Playground</h2>
                    <span className="text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full font-mono font-bold">
                      Live AI Director
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Test how any raw narration or scene draft expands into an 80-120 word studio-grade prompt
                  </p>
                </div>
              </div>
            </div>

            {/* Test Input & Controls */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Raw Scene Description or Narration Line:
                </label>
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="e.g. A lone craftsman carving wooden statues in a candlelit workshop..."
                  className="input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Shot Type Perspective</label>
                  <select
                    value={testShotType}
                    onChange={(e) => setTestShotType(e.target.value as ShotType)}
                    className="input text-xs"
                  >
                    <option value="WIDE_ESTABLISHING">Wide Establishing Vista</option>
                    <option value="AERIAL_GEOMETRY">90° Top-Down Drone</option>
                    <option value="MACRO_TEXTURE">Tactile Macro Close-Up</option>
                    <option value="CULTURAL_HUMAN">Cultural / Human Focus</option>
                    <option value="HISTORICAL_HERITAGE">Historical Heritage Relic</option>
                    <option value="ATMOSPHERIC_MOOD">Atmospheric Weather Mood</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Lighting Preset</label>
                  <select
                    value={selectedLighting}
                    onChange={(e) => setSelectedLighting(e.target.value)}
                    className="input text-xs"
                  >
                    {LIGHTING_MODIFIERS.map((m) => (
                      <option key={m.name} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-1">Camera &amp; Lens</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="input text-xs"
                  >
                    {CAMERA_MODIFIERS.map((m) => (
                      <option key={m.name} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunEnhancementTest}
                disabled={isEnhancing || !testInput.trim()}
                className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-2 mt-1 shadow-md shadow-cyan-950/40"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>AI Director is Expanding Prompt...</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={13} />
                    <span>Enhance Scene Prompt (Live Test)</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Enhanced Output Display */}
            {enhancedResult && (
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-cyan-800/40 space-y-3 animate-fade-in text-xs">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Enhanced Scene Visual Prompt:</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-mono">
                      {enhancedResult.b_roll_focus}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEnhancedPrompt}
                    className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-white transition-colors"
                  >
                    {copiedEnhanced ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedEnhanced ? 'Copied Full Prompt!' : 'Copy Formatted'}</span>
                  </button>
                </div>

                <p className="text-zinc-200 font-mono text-[11px] leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  {enhancedResult.visual_prompt}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-zinc-900/40 p-2 rounded border border-zinc-800/60">
                    <span className="text-slate-400 block mb-0.5 font-semibold">Camera Direction:</span>
                    <span className="text-zinc-300 font-mono">{enhancedResult.camera}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-2 rounded border border-zinc-800/60">
                    <span className="text-slate-400 block mb-0.5 font-semibold">Lighting &amp; Atmosphere:</span>
                    <span className="text-zinc-300 font-mono">{enhancedResult.lighting}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300 block mb-1">Final Prompt Construction for FLUX.1:</span>
                  <div className="font-mono text-zinc-400 leading-normal bg-black/40 p-2 rounded">
                    <span className="text-cyan-300">{enhancedResult.visual_prompt}</span>
                    <span className="text-slate-500">. </span>
                    <span className="text-zinc-300">{baseStylePrompt}</span>
                    {negativePrompt && (
                      <span className="text-red-400">, avoid: {negativePrompt}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Image Generation Base-Style Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
                  <Palette size={16} className="text-zinc-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">Visual Base-Style &amp; Art Presets</h2>
                    <span className="text-[10px] text-zinc-300 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded font-mono">
                      Global
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Default artistic medium, camera optics, and tone applied across all scenes
                  </p>
                </div>
              </div>

              {savedBaseStyleToast && (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 animate-fade-in font-mono">
                  <CheckCircle size={13} /> Base style saved!
                </span>
              )}
            </div>

            {/* Photo / Image Style Dropdown */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="photo-image-style-select" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Palette size={13} className="text-zinc-400" />
                  Select Style Preset
                </label>
                {matchingPreset ? (
                  <span className="text-[11px] text-emerald-400 font-mono">
                    Active: {matchingPreset.name}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-400 font-mono">
                    Custom / Modified
                  </span>
                )}
              </div>
              <select
                id="photo-image-style-select"
                value={selectedStyleValue}
                onChange={(e) => handleSelectStyleDropdown(e.target.value)}
                className="input text-xs font-medium cursor-pointer"
              >
                {STYLE_SHORTCUTS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} — {s.description}
                  </option>
                ))}
                <option value="custom">Custom / User-Defined Style</option>
              </select>
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
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${baseStylePrompt.trim() === s.prompt.trim()
                      ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm ring-1 ring-zinc-500/50'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
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

            {/* Negative Prompt Input with Interactive Quick-Add Chips */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0 flex items-center gap-1.5">
                  <ShieldAlert size={12} className="text-red-400" />
                  Negative Prompt (Defects &amp; Artifacts to Avoid)
                </label>
                <span className="text-[11px] text-slate-500">Excluded tokens</span>
              </div>
              <input
                id="negative-prompt-input"
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="e.g. blurry, distorted faces, low resolution, CGI, cartoon, watermark..."
                className="input font-mono text-xs mb-2"
              />

              {/* Quick-Add Defect Chips */}
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-500 mr-1">Quick Filters:</span>
                {COMMON_NEGATIVE_TAGS.map((tag) => {
                  const isActive = negativePrompt.toLowerCase().includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleNegativeTag(tag)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${isActive
                        ? 'bg-red-950/60 border-red-800/80 text-red-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      title={isActive ? 'Click to remove filter' : 'Click to add filter'}
                    >
                      <span>{tag}</span>
                      {isActive ? '✕' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-bg-border/60">
              <button
                type="button"
                onClick={handleResetBaseStyle}
                className="btn-secondary text-xs"
                title="Reset to default cinematic 8k base style"
              >
                <RotateCcw size={12} />
                Reset Defaults
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

          {/* 4. Directorial Camera & Lighting Modifiers Library */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
                <Layers size={16} className="text-zinc-200" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Directorial Enhancer Ingredients</h2>
                <p className="text-xs text-slate-500">
                  Click any modifier below to instantly append it into your Base Style Prompt
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lighting Modifiers */}
              <div className="p-3.5 rounded-lg bg-bg-base/70 border border-bg-border">
                <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide mb-2">
                  <SunMedium size={12} />
                  Lighting Presets
                </span>
                <div className="space-y-1.5">
                  {LIGHTING_MODIFIERS.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handleAppendModifier(m.value)}
                      className="w-full text-left p-2 rounded-md bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 transition-colors group flex items-start justify-between"
                    >
                      <div>
                        <span className="text-xs font-medium text-white group-hover:text-amber-300 transition-colors">
                          {m.name}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono line-clamp-1 mt-0.5">
                          {m.value}
                        </p>
                      </div>
                      <Plus size={12} className="text-slate-500 group-hover:text-white flex-shrink-0 mt-0.5 ml-2" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Modifiers */}
              <div className="p-3.5 rounded-lg bg-bg-base/70 border border-bg-border">
                <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wide mb-2">
                  <Camera size={12} />
                  Camera &amp; Lens Presets
                </span>
                <div className="space-y-1.5">
                  {CAMERA_MODIFIERS.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handleAppendModifier(m.value)}
                      className="w-full text-left p-2 rounded-md bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 transition-colors group flex items-start justify-between"
                    >
                      <div>
                        <span className="text-xs font-medium text-white group-hover:text-cyan-300 transition-colors">
                          {m.name}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono line-clamp-1 mt-0.5">
                          {m.value}
                        </p>
                      </div>
                      <Plus size={12} className="text-slate-500 group-hover:text-white flex-shrink-0 mt-0.5 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
