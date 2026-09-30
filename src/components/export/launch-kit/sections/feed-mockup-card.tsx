'use client';

import React from 'react';
import { Eye, Image as ImageIcon, Smartphone, Flame } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

export function FeedMockupCard() {
  const {
    project,
    activeThumbnail,
    selectedTitle,
    durationStr,
    isVertical,
  } = useLaunchKit();

  return (
    <div className="card p-5 bg-zinc-900 border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={15} className="text-red-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            {isVertical ? 'YouTube Shorts / Reels Mobile Mockup' : 'YouTube Feed Live Mockup'}
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
          {project.aspectRatio || '16:9'} Frame
        </span>
      </div>

      {/* 16:9 Landscape YouTube Mockup */}
      {!isVertical && (
        <div className="max-w-md mx-auto bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
          <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
            {activeThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeThumbnail}
                alt="YouTube Thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-500 text-xs">
                <ImageIcon size={28} />
                <span>No thumbnail generated</span>
              </div>
            )}
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-white text-[11px] font-mono font-medium tracking-wider">
              {durationStr}
            </span>
          </div>

          <div className="p-3 flex items-start gap-3 bg-zinc-950">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex-shrink-0 flex items-center justify-center font-bold text-xs text-white">
              YT
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                {selectedTitle}
              </h4>
              <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
                <span>Creator Channel</span>
                <span>•</span>
                <span>184K views</span>
                <span>•</span>
                <span>3 hours ago</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 9:16 Vertical Shorts / Reels Phone Mockup */}
      {isVertical && (
        <div className="max-w-[280px] mx-auto bg-black rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-2xl relative aspect-[9/16]">
          {activeThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeThumbnail}
              alt="Shorts Thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs p-4 text-center">
              <Smartphone size={32} className="mb-2" />
              <span>Generate vertical 9:16 thumbnail below</span>
            </div>
          )}

          {/* Shorts UI Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 flex flex-col justify-between p-3.5 pointer-events-none">
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
  );
}
