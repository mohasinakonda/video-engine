'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Cpu,
  ChevronDown,
  Zap,
  Lock,
  Check,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { AIImageModel, PlanTier } from '@/types/subscription';
import { getCurrentUserProfile } from '@/lib/subscription-store';
import { getPollinationsImageModel, savePollinationsImageModel } from '@/lib/store';
import { useOptionalAuth } from '@/contexts/auth-context';

interface ModelSelectorDropdownProps {
  currentModelId?: string;
  onModelSelect?: (model: AIImageModel) => void;
  className?: string;
  size?: 'sm' | 'md';
  compact?: boolean;
  direction?: 'down' | 'up';
  align?: 'left' | 'right';
}

export default function ModelSelectorDropdown({
  currentModelId,
  onModelSelect,
  className = '',
  size = 'md',
  compact = false,
  direction = 'down',
  align = 'right',
}: ModelSelectorDropdownProps) {
  const auth = useOptionalAuth();
  const [models, setModels] = useState<AIImageModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIImageModel | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userTier, setUserTier] = useState<PlanTier>(() => {
    return auth?.profile?.tier || auth?.subscription?.tier || getCurrentUserProfile()?.tier || 'TRIAL';
  });
  const [upgradeModalModel, setUpgradeModalModel] = useState<AIImageModel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep userTier in sync with Auth Context whenever profile loads or changes
  useEffect(() => {
    const tier = auth?.profile?.tier || auth?.subscription?.tier || getCurrentUserProfile()?.tier;
    if (tier) {
      setUserTier(tier);
    }
  }, [auth?.profile?.tier, auth?.subscription?.tier]);

  // Load models from API
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const liveProfile = auth?.profile || getCurrentUserProfile();
        if (liveProfile?.tier) {
          setUserTier(liveProfile.tier);
        }
        const storedModelId = currentModelId || (await getPollinationsImageModel());

        const res = await fetch('/api/models');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.models) && data.models.length > 0) {
            if (!isMounted) return;
            setModels(data.models);

            // Find matching model or default
            const match =
              data.models.find((m: AIImageModel) => m.modelId === storedModelId || m.id === storedModelId) ||
              data.models.find((m: AIImageModel) => m.isDefault) ||
              data.models[0];

            setSelectedModel(match);
            if (onModelSelect && match) {
              onModelSelect(match);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load AI models:', err);
      }
    }

    loadData();

    // Listen to profile updates (e.g. tier upgrade)
    const handleProfileUpdate = () => {
      const p = auth?.profile || getCurrentUserProfile();
      if (p?.tier) setUserTier(p.tier);
    };

    // Listen to cross-component AI model selection sync
    const handleGlobalModelUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<AIImageModel>;
      if (customEvt.detail) {
        setSelectedModel(customEvt.detail);
        if (onModelSelect) {
          onModelSelect(customEvt.detail);
        }
      }
    };

    window.addEventListener('subscription_credits_updated', handleProfileUpdate);
    window.addEventListener('credits_updated', handleProfileUpdate);
    window.addEventListener('auth_profile_loaded', handleProfileUpdate);
    window.addEventListener('ai_model_updated', handleGlobalModelUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('subscription_credits_updated', handleProfileUpdate);
      window.removeEventListener('credits_updated', handleProfileUpdate);
      window.removeEventListener('auth_profile_loaded', handleProfileUpdate);
      window.removeEventListener('ai_model_updated', handleGlobalModelUpdate);
    };
  }, [currentModelId]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (model: AIImageModel) => {
    // Check tier access
    const isAllowed = !model.allowedPlans || model.allowedPlans.length === 0 || model.allowedPlans.includes(userTier);

    if (!isAllowed) {
      setUpgradeModalModel(model);
      setIsOpen(false);
      return;
    }

    setSelectedModel(model);
    setIsOpen(false);
    await savePollinationsImageModel(model.modelId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_model_updated', { detail: model }));
    }
    if (onModelSelect) {
      onModelSelect(model);
    }
  };

  if (!selectedModel && models.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-750 hover:border-cyan-500/50 shadow-sm transition-all font-medium text-white group ${size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          }`}
        title="Select AI Image Generation Engine"
      >

        <div className="flex items-center gap-1.5 text-left">
          <span
            className={`font-semibold text-zinc-200 truncate ${compact ? 'max-w-[100px] sm:max-w-[130px]' : 'max-w-[140px] sm:max-w-[180px]'
              }`}
          >
            {selectedModel?.name || 'Select Model'}
          </span>

        </div>
        <ChevronDown size={size === 'sm' ? 11 : 13} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} ${direction === 'up'
            ? 'bottom-full mb-2 slide-in-from-bottom-2'
            : 'top-full mt-2 slide-in-from-top-2'
            } w-72 sm:w-80 rounded-2xl bg-zinc-900/98 border border-zinc-700/80 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in text-left`}
        >
          <div className="px-3 py-2 border-b border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-cyan-400" />Image Models
            </span>

          </div>

          <div className="py-1.5 max-h-72 overflow-y-auto space-y-1">
            {models.map((model) => {
              const isAllowed =
                !model.allowedPlans ||
                model.allowedPlans.length === 0 ||
                model.allowedPlans.includes(userTier);
              const isSelected = selectedModel?.id === model.id;

              return (
                <div
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-2.5 ${isSelected
                    ? 'bg-cyan-950/40 border border-cyan-500/40'
                    : isAllowed
                      ? 'hover:bg-zinc-800/60 border border-transparent'
                      : 'hover:bg-zinc-800/40 border border-transparent opacity-75'
                    }`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {model.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-mono flex items-center gap-0.5">
                        {model.creditCost} credit/image
                      </span>
                    </div>

                    {model.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                        {model.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 pt-0.5">
                      {!isAllowed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/30">
                          <Lock size={9} /> {model.allowedPlans.join(' & ')} only
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 pt-0.5">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : !isAllowed ? (
                      <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Lock size={10} />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgrade Required Modal */}
      {upgradeModalModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-amber-500/30 p-6 sm:p-7 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Lock size={28} />
            </div>

            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Exclusive High-End AI Model
              </span>
              <h3 className="text-lg font-bold text-white">
                Unlock {upgradeModalModel.name}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                This engine delivers studio-grade photorealism and maximum character consistency. It is exclusively available to creators on{' '}
                <strong className="text-amber-300">{upgradeModalModel.allowedPlans?.join(' and ')}</strong> plans.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs text-left">
              <div>
                <div className="font-semibold text-white">Your Current Plan</div>
                <div className="text-[11px] text-zinc-400">Tier: {userTier}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-amber-400">Upgrade Required</div>
                <div className="text-[11px] text-zinc-400">{upgradeModalModel.creditCost} credits/image</div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUpgradeModalModel(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
              >
                Close
              </button>
              <Link
                href="/plan"
                onClick={() => setUpgradeModalModel(null)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-xs font-bold text-black shadow-lg shadow-amber-950/50 flex items-center justify-center gap-1.5 transition-all"
              >
                Upgrade Plan <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
