import React from 'react';
import { HeroSection } from './landing/hero-section';
import { GrowthLoopSection } from './landing/growth-loop-section';
import { GrowthToolsShowcaseSection } from './landing/growth-tools-showcase-section';
import { KeyFeaturesSection } from './landing/key-features-section';
import { HowItWorksSection } from './landing/how-it-works-section';
import { StoryboardShowcaseSection } from './landing/storyboard-showcase-section';
import { VisualStyleSection } from './landing/visual-style-section';
import { BanglaCreatorsSection } from './landing/bangla-creators-section';
import { PricingSection } from './landing/pricing-section';
import { PaymentMethodsSection } from './landing/payment-methods-section';

export default function GuestView() {
  return (
    <div className="w-full">
      {/* ─── Hero: grow your channel, or make a video from a script ──────── */}
      <HeroSection />

      {/* ─── The growth loop: Doctor → Discover → Create → Make → Analyze ─ */}
      <GrowthLoopSection />

      {/* ─── One row per growth tool, with example illustrations ────────── */}
      <GrowthToolsShowcaseSection />

      {/* ─── Making the video: the studio ───────────────────────────────── */}
      <KeyFeaturesSection />

      {/* ─── How It Works (6-Stage Stepper & Visual Mockups) ─────────────── */}
      <HowItWorksSection />

      {/* ─── Full Control (Storyboard Editor Showcase) ──────────────────── */}
      <StoryboardShowcaseSection />

      {/* ─── Visual Style Engine (Consistent Look) ──────────────────────── */}
      <VisualStyleSection />

      {/* ─── Made for Bangla creators ───────────────────────────────────── */}
      {/*<BanglaCreatorsSection />*/}

      {/* ─── Pricing Section (With Local Bangladesh Support) ───────────── */}
      <PricingSection />

      {/* ─── Payment Methods (Bangla QR) ─────────────────────────────────── */}
      <PaymentMethodsSection />
    </div>
  );
}
