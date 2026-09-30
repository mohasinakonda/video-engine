'use client';

import React from 'react';
import { Search, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import type { CompetitorVideo } from '@/types';
import { useLaunchKit } from '../launch-kit-context';

export function CompetitorResearchCard() {
  const {
    packaging,
    competitorSearchInput,
    setCompetitorSearchInput,
    isSearchingCompetitors,
    handleSearchCompetitors,
  } = useLaunchKit();

  if (!packaging?.marketInsights) return null;
  const { marketInsights } = packaging;

  return (
    <div className="card p-5 bg-zinc-900 border-zinc-800 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-red-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              YouTube Market Research (Competitor Benchmarks)
            </h3>
            <p className="text-[11px] text-zinc-400">
              Live top-ranking competitor videos on this video&apos;s true psychological &amp; scientific concept.
            </p>
          </div>
        </div>

        {/* Interactive Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchCompetitors();
          }}
          className="flex items-center gap-1.5 w-full md:w-auto"
        >
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={competitorSearchInput}
              onChange={(e) => setCompetitorSearchInput(e.target.value)}
              placeholder="Search competitor query..."
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingCompetitors}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 flex-shrink-0"
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

      {/* Strategy Note */}
      <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/30 text-xs text-red-200">
        <strong className="text-white">Competitor Packaging Pattern: </strong>
        {marketInsights.packagingStrategy}
      </div>

      {/* Clickable Suggested Angles / Alternative Queries */}
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

      {/* Competitor Video Cards */}
      {marketInsights.competitorVideos && marketInsights.competitorVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {marketInsights.competitorVideos.map((comp: CompetitorVideo) => (
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
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          No direct competitor videos found for &quot;{competitorSearchInput}&quot;. Try typing a different query above.
        </p>
      )}
    </div>
  );
}
