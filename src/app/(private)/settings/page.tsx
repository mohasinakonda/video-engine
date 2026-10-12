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
  enhanceScenePrompt,
  type EnhancedScenePromptResult,
} from '@/lib/pollinations';
import type { ShotType } from '@/types';
import type { AIImageModel, PlanTier } from '@/types/subscription';
import { getCurrentUserProfile } from '@/lib/subscription-store';
import Link from 'next/link';
import { Lock, Zap } from 'lucide-react';

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
  const [imageModel, setImageModel] = useState('black-forest-labs/FLUX-1-schnell');
  const [dbModels, setDbModels] = useState<AIImageModel[]>([]);
  const [userTier, setUserTier] = useState<PlanTier>('TRIAL');
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
    const profile = getCurrentUserProfile();
    if (profile?.tier) setUserTier(profile.tier);

    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.models) {
          setDbModels(data.models);
        }
      })
      .catch(console.error);

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
      <header className="page-header justify-between">
        <div>
          <h1 className="page-title">
            <Wand2 size={20} className="text-zinc-400" />
            AI Engine &amp; System Settings
          </h1>
          <p className="page-subtitle">
            Configure image AI models, YouTube market research API, and prompt diagnostics
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto page-shell">
        <div className="page-container max-w-4xl space-y-6">

          {/* YouTube Data API & Market Research Card */}
          <div className="card rounded-xl border-rose-500/20 bg-rose-950/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                  <Flame size={16} className="text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-100">YouTube Data &amp; Market Research API</h2>
                    <span className="text-2xs text-rose-300 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded-full font-mono font-bold">
                      Viral Engine
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
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
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Google Cloud YouTube Data API v3 Key (Optional)</span>
                  <span className="text-xxs text-emerald-400 font-mono">
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

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-bg-border text-xxs text-zinc-400 space-y-1">
                <p className="text-zinc-300 font-medium">⚡ How YouTube Market Research Works:</p>
                <p>
                  • <strong>Zero-Config Mode (Default)</strong>: Works 100% free out of the box without any key. Our server searches YouTube and extracts top viral videos, real thumbnails, and view counts automatically.
                </p>
                <p>
                  • <strong>Google Cloud API (Optional)</strong>: To use Google&apos;s official YouTube Data API v3, create a free project at <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" className="text-rose-400 underline">Google Cloud Console</a>, enable &quot;YouTube Data API v3&quot;, generate an API key (includes 10,000 free quota units/day), and paste it above.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Interactive Prompt Enhancement Playground */}
          <div className="card rounded-xl border-bg-border bg-bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-bg-border flex items-center justify-center">
                  <Wand2 size={16} className="text-zinc-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-100">Interactive Prompt Enhancement Playground</h2>
                    <span className="text-2xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full font-mono font-medium">
                      Live AI Director
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Test how any raw narration or scene draft expands into an 80-120 word studio-grade prompt
                  </p>
                </div>
              </div>
            </div>

            {/* Test Input & Controls */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xxs font-semibold text-zinc-300 block mb-1">
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
                  <label className="text-2xs font-semibold text-zinc-400 block mb-1">Shot Type Perspective</label>
                  <select
                    value={testShotType}
                    onChange={(e) => setTestShotType(e.target.value as ShotType)}
                    className="select text-xs w-full"
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
                  <label className="text-2xs font-semibold text-zinc-400 block mb-1">Lighting Preset</label>
                  <select
                    value={selectedLighting}
                    onChange={(e) => setSelectedLighting(e.target.value)}
                    className="select text-xs w-full"
                  >
                    {LIGHTING_MODIFIERS.map((m) => (
                      <option key={m.name} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-2xs font-semibold text-zinc-400 block mb-1">Camera &amp; Lens</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="select text-xs w-full"
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
                className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-2 mt-1 shadow-sm"
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
              <div className="p-4 rounded-xl bg-bg-base border border-bg-border space-y-3 animate-fade-in text-xs">
                <div className="flex items-center justify-between border-b border-bg-border pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-100">Enhanced Scene Visual Prompt:</span>
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                      {enhancedResult.b_roll_focus}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEnhancedPrompt}
                    className="flex items-center gap-1 text-xxs text-zinc-400 hover:text-white transition-colors"
                  >
                    {copiedEnhanced ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedEnhanced ? 'Copied Full Prompt!' : 'Copy Formatted'}</span>
                  </button>
                </div>

                <p className="text-zinc-200 font-mono text-xxs leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-bg-border">
                  {enhancedResult.visual_prompt}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs">
                  <div className="bg-zinc-900/40 p-2 rounded-lg border border-bg-border">
                    <span className="text-zinc-400 block mb-0.5 font-semibold">Camera Direction:</span>
                    <span className="text-zinc-300 font-mono">{enhancedResult.camera}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-2 rounded-lg border border-bg-border">
                    <span className="text-zinc-400 block mb-0.5 font-semibold">Lighting &amp; Atmosphere:</span>
                    <span className="text-zinc-300 font-mono">{enhancedResult.lighting}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-bg-border text-2xs text-zinc-400">
                  <span className="font-semibold text-zinc-300 block mb-1">Prompt Construction Preview:</span>
                  <div className="font-mono text-zinc-400 leading-normal bg-zinc-900/60 p-2.5 rounded-lg border border-bg-border">
                    <span className="text-zinc-200">{enhancedResult.visual_prompt}</span>
                    <span className="text-zinc-500">. </span>
                    <span className="text-zinc-400">Photorealistic, cinematic lighting, 8k resolution, 35mm lens, dramatic shadows</span>
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
