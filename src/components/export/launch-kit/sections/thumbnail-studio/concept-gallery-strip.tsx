'use client';

import React from 'react';
import { useLaunchKit } from '../../launch-kit-context';

export function ConceptGalleryStrip() {
  const { packaging, activeConcept, setActiveConceptId } = useLaunchKit();

  if (!packaging?.thumbnailConcepts || packaging.thumbnailConcepts.length <= 1) {
    return null;
  }

  return (
    <div className="pt-2 border-t border-zinc-800/80 space-y-2">
      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
        All Thumbnail Concepts ({packaging.thumbnailConcepts.length}):
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {packaging.thumbnailConcepts.map((concept, idx) => {
          const isCurrent = (activeConcept?.id || packaging.thumbnailConcepts[0]?.id) === concept.id;
          const hasImg = Boolean(concept.imageUrl);

          return (
            <div
              key={concept.id || idx}
              onClick={() => setActiveConceptId(concept.id)}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                isCurrent
                  ? 'bg-zinc-800/90 border-purple-500 shadow-md ring-1 ring-purple-500/30'
                  : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="w-20 aspect-video rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                {concept.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={concept.imageUrl}
                    alt={concept.conceptName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-[10px] text-zinc-500 font-mono">Draft</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-white truncate">
                    Idea #{idx + 1}: {concept.conceptName}
                  </h5>
                </div>
                <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                  {concept.textOverlayHint || concept.visualPrompt || 'Draft concept'}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                      hasImg
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {hasImg ? 'Ready' : 'Draft'}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] text-purple-400 font-semibold">
                      Active on Stage
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
