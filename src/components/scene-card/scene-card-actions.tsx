'use client';

import React from 'react';
import {
  RefreshCw,
  Maximize2,
  MoreVertical,
  Upload,
  Download,
  Check,
} from 'lucide-react';
import type { SceneItem, ShotType } from '@/types';
import { SHOT_TYPE_CONFIG } from './scene-card-constants';

interface SceneCardActionsProps {
  scene: SceneItem;
  currentSrc?: string;
  imgError: boolean;
  isGenerating: boolean;
  disabled?: boolean;
  hovering: boolean;
  moreMenuOpen: boolean;
  isSubmittingRegenerate: boolean;
  onSetMoreMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  onRegenerate: () => void;
  onOpenPreview: () => void;
  onUploadClick: () => void;
  onSwitchShotType: (type: ShotType) => void;
}

export default function SceneCardActions({
  scene,
  currentSrc,
  imgError,
  isGenerating,
  disabled,
  hovering,
  moreMenuOpen,
  isSubmittingRegenerate,
  onSetMoreMenuOpen,
  onRegenerate,
  onOpenPreview,
  onUploadClick,
  onSwitchShotType,
}: SceneCardActionsProps) {
  if (isGenerating || disabled) return null;

  return (
    <div
      className={`absolute top-2.5 right-2.5 ${moreMenuOpen ? 'z-50' : 'z-20'
        } flex items-center gap-1.5 pointer-events-auto`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`flex items-center gap-0.5 p-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 shadow-xl transition-all duration-200 ${hovering || moreMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
      >
        {/* Regenerate */}
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isSubmittingRegenerate}
          className="w-5 h-5 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all active:scale-90"
          title="Regenerate image"
        >
          <RefreshCw size={11} className={isSubmittingRegenerate ? 'animate-spin' : ''} />
        </button>

        {/* Quick Download */}
        {currentSrc && !imgError && (
          <a
            href={currentSrc}
            download={`scene_${scene.sceneId}.jpg`}
            onClick={() => onSetMoreMenuOpen(false)}
            className="w-5 h-5 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all active:scale-90"
            title="Download image"
          >
            <Download size={11} className="text-cyan-400" />
          </a>
        )}

        {/* More Options Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => onSetMoreMenuOpen((v) => !v)}
            className={`w-5 h-5 flex items-center justify-center rounded-full transition-all active:scale-90 ${moreMenuOpen ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/20'
              }`}
            title="More options (Creative Studio, B-Roll, Upload, Download)"
          >
            <MoreVertical size={11} />
          </button>

          {/* More Menu Dropdown & Click Outside Backdrop */}
          {moreMenuOpen && (
            <>
              {/* Invisible full-screen backdrop to close menu on click outside */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetMoreMenuOpen(false);
                }}
              />

              <div
                className="absolute right-0 top-full mt-2 z-50 w-52 max-h-[260px] overflow-y-auto rounded-xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl backdrop-blur-xl p-1.5 space-y-1 animate-fade-in text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSetMoreMenuOpen(false);
                    onUploadClick();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Upload size={12} className="text-emerald-400" />
                  <span>Replace Image</span>
                </button>



                {/* Switch B-Roll Perspective */}
                <div className="border-t border-zinc-800 my-1 pt-1">
                  <span className="px-2 py-0.5 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block">
                    Switch B-Roll Perspective
                  </span>
                  {(Object.keys(SHOT_TYPE_CONFIG) as ShotType[]).map((type) => {
                    const conf = SHOT_TYPE_CONFIG[type];
                    const IconComponent = conf.icon;
                    const isSelected = scene.shotType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          onSetMoreMenuOpen(false);
                          onSwitchShotType(type);
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-colors ${isSelected
                          ? 'bg-zinc-800 text-white font-medium'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                          }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <IconComponent
                            size={11}
                            className={isSelected ? 'text-white' : 'text-zinc-400'}
                          />
                          <span>{conf.shortLabel}</span>
                        </div>
                        {isSelected && <Check size={10} className="text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
