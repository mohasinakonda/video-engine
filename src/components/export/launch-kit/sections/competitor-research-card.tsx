'use client';

import React from 'react';
import { Search, Loader2, Sparkles, ExternalLink, Eye, Flame } from 'lucide-react';
import type { CompetitorVideo } from '@/types';
import { useLaunchKit } from '../launch-kit-context';

export function CompetitorResearchCard() {
  const {
    packaging,
    competitorSearchInput,
    setCompetitorSearchInput,
    isSearchingCompetitors,
    handleSearchCompetitors,
    standoutMode,
    setStandoutMode,
    activeThumbnail,
    selectedTitle,
    durationStr,
  } = useLaunchKit();

  if (!packaging?.marketInsights) return null;
  const { marketInsights } = packaging;

  return (
    <div className="card p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Search size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>YouTube Market Intelligence &amp; Benchmarks</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                Live Data
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Live top-ranking competitor videos on this video&apos;s exact topic
            </p>
          </div>
        </div>

        {/* Standout Test Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStandoutMode(!standoutMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${standoutMode
              ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-lg shadow-amber-500/20'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            title="Inject your planned video into this competitor grid to see if it stands out"
          >
            <Eye size={13} />
            <span>{standoutMode ? '✓ Standout Test ON' : 'The Standout Test'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Search Bar & Strategy Note */}
      <div className="flex flex-col  items-stretch  justify-between gap-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchCompetitors();
          }}
          className="flex items-center gap-1.5 w-full sm:w-auto"
        >
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              value={competitorSearchInput}
              onChange={(e) => setCompetitorSearchInput(e.target.value)}
              placeholder="Search competitor topic query..."
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingCompetitors}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {isSearchingCompetitors ? (
              <Loader2 size={12} className="animate-spin text-red-400" />
            ) : (
              <Search size={12} className="text-red-400" />
            )}
            <span>Search</span>
          </button>
        </form>

      </div>

      {/* Suggested Angle Chips */}
      {marketInsights.alternativeSearchQueries && marketInsights.alternativeSearchQueries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
            <Sparkles size={11} className="text-amber-400" />
            Explore Angles:
          </span>
          {marketInsights.alternativeSearchQueries.map((query) => (
            <button
              key={query}
              type="button"
              onClick={() => handleSearchCompetitors(query)}
              disabled={isSearchingCompetitors}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-800/80 hover:bg-red-950/40 text-zinc-300 hover:text-red-200 border border-zinc-700 hover:border-red-700/50 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Search size={10} className="text-red-400" />
              <span>{query}</span>
            </button>
          ))}
        </div>
      )}

      {/* Standout Comparison Banner (When Active) */}
      {standoutMode && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Flame size={15} className="text-amber-400 shrink-0" />
            <span>
              <strong>The Standout Test is Active: </strong> Your video is injected at position #1. Compare your visual contrast against rival videos below!
            </span>
          </div>
        </div>
      )}

      {/* Competitor Video Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Injected User Card when Standout Mode is Active */}
        {standoutMode && (
          <div className="rounded-xl overflow-hidden border-2 border-amber-400 bg-zinc-950 shadow-xl shadow-amber-500/10 flex flex-col justify-between ring-2 ring-amber-400/20">
            <div>
              <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                {activeThumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeThumbnail}
                    alt={selectedTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                    No Thumbnail Yet
                  </div>
                )}
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono font-bold text-white">
                  {durationStr}
                </span>
                <span className="absolute top-1 left-1 px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-black text-[9px] uppercase tracking-wider shadow-md">
                  ★ YOUR VIDEO
                </span>
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-[11px] font-bold text-white line-clamp-2 leading-snug">
                  {selectedTitle}
                </p>
                <p className="text-[10px] text-amber-300 font-semibold truncate">
                  @YourChannel • Just now
                </p>
              </div>
            </div>
            <div className="px-2.5 pb-2 text-[10px] text-amber-400 font-bold flex items-center gap-1">
              <span>Standout Target Score: 98%</span>
            </div>
          </div>
        )}

        {/* Real Competitor Videos */}
        {marketInsights.competitorVideos && marketInsights.competitorVideos.length > 0 ? (
          marketInsights.competitorVideos.map((comp: CompetitorVideo) => (
            <a
              key={comp.id}
              href={comp.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comp.thumbnail}
                    alt={comp.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-zinc-200">
                    {comp.views}
                  </span>
                </div>
                <div className="p-2.5 space-y-1">
                  <p className="text-[11px] font-semibold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                    {comp.title}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    {comp.channel}
                  </p>
                </div>
              </div>
              <div className="px-2.5 pb-2 text-[10px] text-zinc-500 flex items-center gap-1 group-hover:text-zinc-300">
                <ExternalLink size={10} />
                <span>Watch on YouTube</span>
              </div>
            </a>
          ))
        ) : (
          <p className="text-xs text-zinc-500 col-span-4 p-4 text-center">
            No competitor videos found for &quot;{competitorSearchInput}&quot;. Try typing a different search query above.
          </p>
        )}
      </div>
    </div>
  );
}
