'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  Check,
  Film,
  Camera,
  Layers,
  Wand2,
} from 'lucide-react';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-store';
import type { BillingCycle, SubscriptionPlan } from '@/types/subscription';

const FEATURED_STYLES = [
  {
    id: 'cinematic',
    title: '35mm Cinematic Realism',
    tag: 'Default Studio Preset',
    description: 'Natural volumetric lighting, Kodak 500T 35mm grain, anamorphic shallow depth of field, documentary warmth.',
    prompt: 'Cinematic wide shot of an ancient riverside village at sunrise, soft golden haze, cinematic 35mm film photography, 8k resolution, Photorealistic masterpiece',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ghibli',
    title: 'Vintage Ghibli Animation',
    tag: 'Storybook & Lore',
    description: 'Hand-painted watercolor aesthetic, lush rolling green hills, nostalgic pastel skies, emotional atmospheric charm.',
    prompt: 'Studio Ghibli aesthetic, charming rural countryside station, fluffy cumulus clouds, hand-painted anime landscape, Hayao Miyazaki style, vivid colors',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'cyberpunk',
    title: 'Neo-Noir Cyberpunk',
    tag: 'High-Tech & Sci-Fi',
    description: 'Rain-slicked asphalt, neon teal and magenta reflections, atmospheric vapor fog, cinematic anamorphic bokeh.',
    prompt: 'Cyberpunk mega-city street at midnight in heavy neon rain, holographic billboards reflecting on wet pavement, cinematic lighting, 8k octane render',
    image: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'documentary',
    title: 'Historical Epic & Heritage',
    tag: 'Cultural & National',
    description: 'Historical authenticity, aged stone textures, golden hour dust particles, timeless architectural grandeur.',
    prompt: 'Ancient terracotta palace courtyard in Bengal, dramatic dust beams through carved pillars, historical documentary photography, hyper-detailed',
    image: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
  },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Narrative & Script Breakdown',
    subtitle: 'Autonomous Scene Director',
    description: 'Paste raw text or record voiceover. The engine segments sentences, assigns dramatic pacing, and creates rich visual scene prompts matching your narrative arc.',
    icon: Wand2,
  },
  {
    step: '02',
    title: 'High-Fidelity Visual Synthesis',
    subtitle: 'Multi-Threaded Rendering',
    description: 'High-speed image generation across parallel workers. Prompts adhere strictly to your chosen aesthetic preset with persistent mood and character consistency.',
    icon: Camera,
  },
  {
    step: '03',
    title: 'Cinematic Camera Dynamics',
    subtitle: 'Automated Motion Paths',
    description: 'Applies smooth Ken Burns camera movements (slow zooms, pans, macro holds) tailored dynamically to each scene\'s exact audio duration.',
    icon: Film,
  },
  {
    step: '04',
    title: 'Audio Alignment & MP4 Export',
    subtitle: 'Hardware-Accelerated Muxing',
    description: 'Stereo audio normalization, subtitle synchronization, and instant browser-side single-pass MP4 compilation with zero upload wait times.',
    icon: Layers,
  },
];

export default function GuestView() {
  const [activeStyleIdx, setActiveStyleIdx] = useState(0);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const activeStyle = FEATURED_STYLES[activeStyleIdx];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-white font-sans antialiased">
      {/* ─── Minimalist Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-850 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-bold shadow-sm">
              <Zap size={16} className="fill-zinc-950" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">AI Video Studio</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-400">
            <a href="#showcase" className="hover:text-white transition-colors">Showcase</a>
            <a href="#process" className="hover:text-white transition-colors">Process</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-medium text-zinc-300 hover:text-white px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 transition-colors shadow-sm"
            >
              Start Free (30 Credits)
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ──────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden border-b border-zinc-850">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Autonomous Video Synthesis Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            From Script to Screen. <br />
            <span className="text-zinc-400 font-normal">Without a Camera.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-zinc-400 text-base sm:text-lg leading-relaxed font-normal">
            Convert long-form narratives, historical chronicles, and educational scripts into broadcast-quality 1080p MP4 videos with automated scene direction, voiceover synchronization, and fluid camera motion.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Start Creating Free</span>
              <ArrowRight size={15} />
            </Link>
            <a
              href="#showcase"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 font-medium text-sm transition-colors"
            >
              Explore Art Styles
            </a>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-zinc-300" /> 1080p Full HD Export
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-zinc-300" /> Zero Watermarks
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-zinc-300" /> Native bKash & Nagad
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-zinc-300" /> 30 Credits on Sign Up
            </span>
          </div>
        </div>
      </section>

      {/* ─── Featured Style Gallery (3-4 Art Styles Showcase) ──────────── */}
      <section id="showcase" className="py-24 px-6 border-b border-zinc-850 bg-zinc-950">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Visual Aesthetic Engine</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">
                Curated Cinematic Style Presets
              </h2>
            </div>
            <p className="text-xs text-zinc-400 max-w-sm">
              Each preset enforces consistent lighting, color palettes, and cinematic textures across every scene in your video.
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-850">
            {FEATURED_STYLES.map((style, idx) => (
              <button
                key={style.id}
                onClick={() => setActiveStyleIdx(idx)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeStyleIdx === idx
                    ? 'bg-zinc-850 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <span>{style.title}</span>
                <span className="text-[10px] text-zinc-400 font-normal">({style.tag})</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-zinc-900/50 border border-zinc-850 rounded-3xl p-6 sm:p-8">
            <div className="lg:col-span-7 relative rounded-2xl overflow-hidden aspect-video bg-zinc-950 border border-zinc-800 shadow-2xl">
              <img
                src={activeStyle.image}
                alt={activeStyle.title}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] font-mono text-zinc-300 border border-white/10">
                Aesthetic: {activeStyle.title}
              </div>
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-zinc-400 border border-white/10">
                16:9 High Precision
              </div>
            </div>

            <div className="lg:col-span-5 space-y-5">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  Preset Profile
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{activeStyle.title}</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  {activeStyle.description}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[10px] uppercase font-mono text-zinc-400 font-semibold block">
                  Enforced Visual Prompt
                </span>
                <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                  &ldquo;{activeStyle.prompt}&rdquo;
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-zinc-300 transition-colors"
                >
                  <span>Create video using this style</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Video Generation Process ──────────────────────────────────── */}
      <section id="process" className="py-24 px-6 border-b border-zinc-850 bg-zinc-950">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Architectural Pipeline</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              How the Engine Constructs Videos
            </h2>
            <p className="text-xs text-zinc-400">
              From pure raw text to a synchronized 1080p video file in four disciplined steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {PROCESS_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-850 space-y-4 hover:border-zinc-750 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-zinc-500">{step.step}</span>
                    <span className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300">
                      <Icon size={16} />
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">{step.title}</h4>
                    <p className="text-[11px] font-mono text-emerald-400 mt-0.5">{step.subtitle}</p>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Pricing Section (Plans Only, No Topup) ────────────────────── */}
      <section id="pricing" className="py-24 px-6 border-b border-zinc-850 bg-zinc-950">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Transparent Subscriptions</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Simple, Predictable Creator Pricing
            </h2>
            <p className="text-xs text-zinc-400">
              Pay easily via bKash, Nagad, or Bank Transfer. Instant WhatsApp verification.
            </p>

            <div className="pt-2 flex justify-center items-center gap-3">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  billingCycle === 'yearly'
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Yearly</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEFAULT_SUBSCRIPTION_PLANS.map((plan: SubscriptionPlan) => {
              const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-3xl p-7 border transition-all ${
                    plan.popular
                      ? 'bg-zinc-900 border-emerald-500/50 shadow-xl'
                      : 'bg-zinc-900/40 border-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-white text-lg">{plan.name}</span>
                    {plan.badge && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div className="mb-6 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-white">৳{price}</span>
                    <span className="text-xs text-zinc-400">
                      / {billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-400 font-medium mb-6">
                    {plan.creditsPerMonth} Image Credits / month
                  </p>

                  <ul className="space-y-3 text-xs text-zinc-300 flex-1 mb-8">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/pricing"
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition-all ${
                      plan.popular
                        ? 'bg-white hover:bg-zinc-200 text-zinc-950'
                        : 'bg-zinc-850 hover:bg-zinc-800 text-white border border-zinc-750'
                    }`}
                  >
                    Select {plan.name} Plan
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-4">
            <Link
              href="/pricing"
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 underline"
            >
              Have a Promo Code or Need Custom Top-ups? Visit Full Pricing Page &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 bg-zinc-950 border-t border-zinc-850 text-xs text-zinc-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-bold">
              <Zap size={13} className="fill-zinc-950" />
            </div>
            <span className="font-bold text-white text-sm">AI Video Studio</span>
            <span className="text-zinc-500 ml-2">© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-white transition-colors">Login</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <a
              href="https://wa.me/8801712345678"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              WhatsApp Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
