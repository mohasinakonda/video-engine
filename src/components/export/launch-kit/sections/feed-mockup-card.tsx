'use client';

import React, { useState } from 'react';
import {
  Eye,
  Image as ImageIcon,
  Smartphone,
  Flame,
  Monitor,
  CheckCircle,
  Copy,
  Download,
  Share2,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

export function FeedMockupCard() {
  const {
    project,
    activeThumbnail,
    selectedTitle,
    durationStr,
    isVertical,
    copiedKey,
    handleCopyMasterLaunchPack,
    handleDownloadThumbnail,
    activeConcept,
  } = useLaunchKit();

  const [simulatorMode, setSimulatorMode] = useState<'mobile' | 'desktop' | 'shorts'>(
    isVertical ? 'shorts' : 'mobile'
  );
  const [mobileScaleDown, setMobileScaleDown] = useState(false);

  return (
    <div className="card p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 space-y-4 shadow-2xl">
      {/* Header with Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/80">


        {/* Simulator Mode Tabs */}
        <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => setSimulatorMode('mobile')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors ${simulatorMode === 'mobile'
              ? 'bg-zinc-800 text-white font-bold'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            <Smartphone size={11} />
            <span>Mobile</span>
          </button>
          <button
            type="button"
            onClick={() => setSimulatorMode('desktop')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors ${simulatorMode === 'desktop'
              ? 'bg-zinc-800 text-white font-bold'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            <Monitor size={11} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setSimulatorMode('shorts')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors ${simulatorMode === 'shorts'
              ? 'bg-red-950/60 text-red-300 font-bold'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            <Flame size={11} />
            <span>Shorts</span>
          </button>
        </div>
      </div>

      {/* 120px Mobile Feed Eye-Test Toggle */}
      {simulatorMode === 'mobile' && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg   text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <ZoomIn size={12} className="text-amber-400" />
            <span>120px Arm&apos;s-Length Eye Test:</span>
          </span>
          <button
            type="button"
            onClick={() => setMobileScaleDown(!mobileScaleDown)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${mobileScaleDown
              ? 'bg-amber-400 text-zinc-950 font-bold border-amber-300'
              : 'bg-zinc-850 text-zinc-300 border-zinc-700'
              }`}
          >
            {mobileScaleDown ? 'Scale: 120px (Active)' : 'Normal Scale'}
          </button>
        </div>
      )}

      {/* Simulator Stage */}
      <div className="flex items-center justify-center min-h-[300px] p-2 bg-zinc-950 rounded-xl overflow-hidden">
        {/* MODE 1: Mobile App Feed Card */}
        {simulatorMode === 'mobile' && (
          <div
            className={`w-full bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl transition-all ${mobileScaleDown ? 'max-w-[200px] scale-90' : 'max-w-[360px]'
              }`}
          >
            <div className="relative aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden">
              {activeThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeThumbnail}
                  alt={selectedTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-500 text-xs">
                  <ImageIcon size={24} />
                  <span>No Thumbnail Generated</span>
                </div>
              )}
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/90 text-white text-[10px] font-mono font-bold tracking-wider">
                {durationStr}
              </span>
            </div>

            <div className="p-3 flex items-start gap-2.5 bg-zinc-950">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-amber-400 flex-shrink-0 flex items-center justify-center font-black text-[11px] text-white shadow-md">
                YT
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                  {selectedTitle}
                </h4>
                <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                  <span className="truncate">Creator Channel</span>
                  <span>•</span>
                  <span>240K views</span>
                  <span>•</span>
                  <span>4 hours ago</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: Desktop Search / Recommendation Result */}
        {simulatorMode === 'desktop' && (
          <div className="w-full max-w-[460px] bg-black p-3 rounded-xl border border-zinc-800 shadow-2xl flex items-start gap-3">
            <div className="relative w-44 aspect-video bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0">
              {activeThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeThumbnail}
                  alt={selectedTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-[10px]">
                  <ImageIcon size={18} />
                </div>
              )}
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/90 text-white text-[9px] font-mono font-bold">
                {durationStr}
              </span>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug hover:text-blue-400 cursor-pointer">
                {selectedTitle}
              </h4>
              <p className="text-[10px] text-zinc-400">
                Creator Channel • 320K views
              </p>
              <p className="text-[10px] text-zinc-400 line-clamp-2 pt-0.5 leading-relaxed">
                {project.youtubePackaging?.scriptIntelligence?.narrativeSummary ||
                  'Deep dive analysis into this fascinating phenomenon with evidence and takeaways.'}
              </p>
            </div>
          </div>
        )}

        {/* MODE 3: Shorts 9:16 Mobile Player */}
        {simulatorMode === 'shorts' && (
          <div className="w-full max-w-[260px] bg-black rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-2xl relative aspect-[9/16]">
            {activeThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeThumbnail}
                alt="Shorts Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs p-4 text-center">
                <Smartphone size={32} className="mb-2" />
                <span>Shorts vertical view</span>
              </div>
            )}

            {/* Shorts UI Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 flex flex-col justify-between p-3 pointer-events-none">
              <div className="flex justify-between items-center text-[10px] text-white/80">
                <span className="font-bold flex items-center gap-1">
                  <Flame size={12} className="text-red-500" /> Shorts
                </span>
                <span className="font-mono">{durationStr}</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-[9px] flex items-center justify-center">
                    YT
                  </div>
                  <span className="text-[11px] font-semibold text-white">@creator</span>
                </div>
                <p className="text-xs font-bold text-white line-clamp-2 leading-snug">
                  {selectedTitle}
                </p>
                <p className="text-[10px] text-zinc-300">#shorts #viral</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Master 1-Click Launch Pack Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={handleCopyMasterLaunchPack}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xl shadow-red-600/20 transition-all"
        >
          {copiedKey === 'master_launch_pack' ? (
            <>
              <CheckCircle size={15} className="text-white" />
              <span>Copied Complete Launch Pack!</span>
            </>
          ) : (
            <>
              <Sparkles size={15} className="text-amber-200" />
              <span>Copy Complete YouTube Launch Pack (1-Click)</span>
            </>
          )}
        </button>

        {activeConcept && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadThumbnail(activeConcept)}
              className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download size={13} className="text-purple-400" />
              <span>Download Active Thumbnail</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
