
import React from 'react';
import { LandingNavbar } from './landing/navbar';
import { HeroSection } from './landing/hero-section';
import { HowItWorksSection } from './landing/how-it-works-section';
import { SceneBuilderSection } from './landing/scene-builder-section';
import { NarrationTimelineSection } from './landing/narration-timeline-section';
import { StoryboardShowcaseSection } from './landing/storyboard-showcase-section';
import { VisualStyleSection } from './landing/visual-style-section';
import { BuiltForEditingSection } from './landing/built-for-editing-section';
import { FeaturesSection } from './landing/features-section';
import { PricingSection } from './landing/pricing-section';
import { LandingFooter } from './landing/footer';

export default function GuestView() {

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-zinc-800 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* ─── Sticky Navbar ──────────────────────────────────────────────── */}
      <LandingNavbar />

      {/* ─── Hero Section ───────────────────────────────────────────────── */}
      <HeroSection

      />

      {/* ─── How It Works (6-Stage Stepper & Visual Mockups) ─────────────── */}
      <HowItWorksSection />

      {/* ─── AI Scene Builder Feature (Split Screen) ────────────────────── */}
      <SceneBuilderSection />

      {/* ─── Narration & Timeline Sync ───────────────────────────────────── */}
      <NarrationTimelineSection />

      {/* ─── Full Control (Storyboard Editor Showcase) ──────────────────── */}
      <StoryboardShowcaseSection

      />

      <PricingSection />


      {/* ─── Visual Style Engine (Consistent Look) ──────────────────────── */}
      <VisualStyleSection

      />

      {/* ─── Built For Editing (Pipeline & Export) ───────────────────────── */}
      <BuiltForEditingSection />

      {/* ─── Features Matrix Grid ───────────────────────────────────────── */}
      <FeaturesSection />

      {/* ─── Pricing Section (With Local Bangladesh Support) ───────────── */}


      {/* ─── Ready to Create? (Interactive Script Banner) ───────────────── */}
      {/* <ReadyToCreateSection /> */}

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}
