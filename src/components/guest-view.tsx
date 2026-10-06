
import React from 'react';
import { HeroSection } from './landing/hero-section';
import { HowItWorksSection } from './landing/how-it-works-section';
import { SceneBuilderSection } from './landing/scene-builder-section';
import { NarrationTimelineSection } from './landing/narration-timeline-section';
import { StoryboardShowcaseSection } from './landing/storyboard-showcase-section';
import { VisualStyleSection } from './landing/visual-style-section';
import { BuiltForEditingSection } from './landing/built-for-editing-section';
import { FeaturesSection } from './landing/features-section';
import { PricingSection } from './landing/pricing-section';

export default function GuestView() {
  return (
    <div className="w-full">
      {/* ─── Hero Section ───────────────────────────────────────────────── */}
      <HeroSection />

      {/* ─── How It Works (6-Stage Stepper & Visual Mockups) ─────────────── */}
      <HowItWorksSection />

      {/* ─── AI Scene Builder Feature (Split Screen) ────────────────────── */}
      <SceneBuilderSection />

      {/* ─── Narration & Timeline Sync ───────────────────────────────────── */}
      <NarrationTimelineSection />

      {/* ─── Full Control (Storyboard Editor Showcase) ──────────────────── */}
      <StoryboardShowcaseSection />

      {/* ─── Visual Style Engine (Consistent Look) ──────────────────────── */}
      <VisualStyleSection />

      {/* ─── Built For Editing (Pipeline & Export) ───────────────────────── */}
      <BuiltForEditingSection />

      {/* ─── Features Matrix Grid ───────────────────────────────────────── */}
      <FeaturesSection />

      {/* ─── Pricing Section (With Local Bangladesh Support) ───────────── */}
      <PricingSection />
    </div>
  );
}
