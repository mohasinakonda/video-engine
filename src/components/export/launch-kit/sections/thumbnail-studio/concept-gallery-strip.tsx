'use client';

import React from 'react';
import { useLaunchKit } from '../../launch-kit-context';

export function ConceptGalleryStrip() {
  const { packaging, activeConcept, setActiveConceptId } = useLaunchKit();

  if (!packaging?.thumbnailConcepts || packaging.thumbnailConcepts.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-zinc-400 block">
        Compare ideas ({packaging.thumbnailConcepts.length})
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {packaging.thumbnailConcepts.map((concept, idx) => {
          const isCurrent = (activeConcept?.id || packaging.thumbnailConcepts[0]?.id) === concept.id;
          const hasImg = Boolean(concept.imageUrl);

          return (
            <button
              type="button"
              key={concept.id || idx}
              onClick={() => setActiveConceptId(concept.id)}
              aria-pressed={isCurrent}
              className={`text-left rounded-xl border overflow-hidden transition-all ${
                isCurrent
                  ? 'border-white/60 ring-2 ring-white/20 bg-zinc-900'
                  : 'border-zinc-800 hover:border-zinc-600 bg-zinc-950/80'
              }`}
            >
              <div className="relative aspect-video bg-zinc-900 flex items-center justify-center">
                {concept.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={concept.imageUrl}
                    alt={concept.conceptName}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-zinc-500">Not generated yet</span>
                )}
                {isCurrent && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white text-zinc-950 text-2xs font-bold">
                    Selected
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-white truncate">
                  Idea #{idx + 1}: {concept.conceptName}
                </p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {concept.textOverlayHint || (hasImg ? 'Ready' : 'Draft')}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
