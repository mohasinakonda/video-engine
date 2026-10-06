'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface StyleHeaderProps {
  onOpenCreateModal: () => void;
}

export function StyleHeader({
  onOpenCreateModal,
}: StyleHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
      <div>

        <div className="flex items-center gap-3">

          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Art Styles & Visual Presets Studio
              </h1>

            </div>

          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">

        <button
          onClick={onOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-900/30 transition-all"
        >
          <Plus size={15} /> Add New Style
        </button>
      </div>
    </div>
  );
}
