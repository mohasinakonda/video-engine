'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  Loader2,
  Wand2,
  Copy,
  Flame,
} from 'lucide-react';
import {
  getPollinationsImageModel,
  savePollinationsImageModel,
  getYouTubeApiKey,
  saveYouTubeApiKey,
} from '@/lib/store';
import {
  POPULAR_POLLINATIONS_MODELS,
  enhanceScenePrompt,
  type EnhancedScenePromptResult,
} from '@/lib/pollinations';
import type { ShotType } from '@/types';

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

export default function SettingsPage() {
  const [imageModel, setImageModel] = useState('flux');
  const [savedModelToast, setSavedModelToast] = useState(false);

  // Playground / Enhancer Tester State
  const [testInput, setTestInput] = useState('A solitary wooden boat floating on a serene mountain lake at sunrise');
  const [testShotType, setTestShotType] = useState<ShotType>('WIDE_ESTABLISHING');
  const [selectedLighting, setSelectedLighting] = useState(LIGHTING_MODIFIERS[0].value);
  const [selectedCamera, setSelectedCamera] = useState(CAMERA_MODIFIERS[0].value);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedResult, setEnhancedResult] = useState<EnhancedScenePromptResult | null>(null);
  const [copiedEnhanced, setCopiedEnhanced] = useState(false);

  // YouTube Data API State
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [savedYoutubeToast, setSavedYoutubeToast] = useState(false);
  const [savingYoutubeKey, setSavingYoutubeKey] = useState(false);

  useEffect(() => {
    getPollinationsImageModel().then((m) => {
      setImageModel(m);
    });
    getYouTubeApiKey().then((k) => {
      setYoutubeApiKey(k);
    });
  }, []);

  async function handleSaveYouTubeKey() {
    setSavingYoutubeKey(true);
    await saveYouTubeApiKey(youtubeApiKey);
    setSavingYoutubeKey(false);
    setSavedYoutubeToast(true);
    setTimeout(() => setSavedYoutubeToast(false), 2500);
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
        stylePrompt: 'Photorealistic, cinematic lighting, 8k resolution, 35mm lens, dramatic shadows',
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
    const finalPrompt = `${enhancedResult.visual_prompt}. Photorealistic, cinematic lighting, 8k resolution, 35mm lens, dramatic shadows`;
    navigator.clipboard.writeText(finalPrompt);
    setCopiedEnhanced(true);
    setTimeout(() => setCopiedEnhanced(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-base">
      {/* Header */}
      <header className="px-8 py-5 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wand2 size={20} className="text-cyan-400" />
            AI Engine &amp; System Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure image AI models, YouTube market research API, and prompt diagnostics
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

          {/* YouTube Data API & Market Research Card */}
          <div className="card border-red-500/20 bg-gradient-to-b from-red-950/10 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <Flame size={16} className="text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">YouTube Data &amp; Market Research API</h2>
                    <span className="text-[10px] text-red-300 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded-full font-mono font-bold">
                      Viral Engine
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live competitor video search, view benchmarking, and packaging intelligence
                  </p>
                </div>
              </div>

              {savedYoutubeToast && (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 animate-fade-in font-mono">
                  <CheckCircle size={13} /> Key saved!
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Google Cloud YouTube Data API v3 Key (Optional)</span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    {youtubeApiKey ? '● Official API Active' : '● Zero-Config Mode Active'}
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={youtubeApiKey}
                    onChange={(e) => setYoutubeApiKey(e.target.value)}
                    placeholder="AIzaSy... (Leave blank for zero-config free parser)"
                    className="input text-xs font-mono flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSaveYouTubeKey}
                    disabled={savingYoutubeKey}
                    className="btn-primary text-xs px-4 flex items-center gap-1.5"
                  >
                    {savingYoutubeKey ? <Loader2 size={13} className="animate-spin" /> : 'Save Key'}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <p className="text-zinc-300 font-medium">⚡ How YouTube Market Research Works:</p>
                <p>
                  • <strong>Zero-Config Mode (Default)</strong>: Works 100% free out of the box without any key. Our server searches YouTube and extracts top viral videos, real thumbnails, and view counts automatically.
                </p>
                <p>
                  • <strong>Google Cloud API (Optional)</strong>: To use Google&apos;s official YouTube Data API v3, create a free project at <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" className="text-red-400 underline">Google Cloud Console</a>, enable &quot;YouTube Data API v3&quot;, generate an API key (includes 10,000 free quota units/day), and paste it above.
                </p>
              </div>
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
                  <span className="font-semibold text-slate-300 block mb-1">Prompt Construction Preview:</span>
                  <div className="font-mono text-zinc-400 leading-normal bg-black/40 p-2 rounded">
                    <span className="text-cyan-300">{enhancedResult.visual_prompt}</span>
                    <span className="text-slate-500">. </span>
                    <span className="text-zinc-300">Photorealistic, cinematic lighting, 8k resolution, 35mm lens, dramatic shadows</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
