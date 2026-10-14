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
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-bg-border">
      <div>
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Art Styles &amp; Visual Presets Studio
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <a
          href="/admin"
          className="btn-secondary text-xs py-1.5 px-3"
        >
          Admin Hub
        </a>
        <a
          href="/admin/models"
          className="btn-secondary text-xs py-1.5 px-3"
        >
          AI Models
        </a>
        <button
          onClick={onOpenCreateModal}
          className="btn-primary text-xs py-2 px-4 flex items-center gap-2"
        >
          <Plus size={15} /> Add New Style
        </button>
      </div>
    </div>
  );
}
