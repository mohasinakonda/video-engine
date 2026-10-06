'use client';

import React from 'react';
import { Eye, EyeOff, Edit3, Trash2, Copy, Check, Image as ImageIcon } from 'lucide-react';
import type { BaseStylePreset } from '@/types';

interface StyleCardProps {
  style: BaseStylePreset;
  copiedId: string | null;
  onToggleActive: (id: string, currentStatus: boolean) => void;
  onOpenEdit: (style: BaseStylePreset) => void;
  onDelete: (id: string, name: string) => void;
  onCopyPrompt: (id: string, prompt: string) => void;
}

export function StyleCard({
  style: s,
  copiedId,
  onToggleActive,
  onOpenEdit,
  onDelete,
  onCopyPrompt,
}: StyleCardProps) {
  const isItemActive = s.isActive !== false;

  return (
    <div
      className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden bg-zinc-900/40 ${
        isItemActive
          ? 'border-zinc-800/80 hover:border-zinc-700/80'
          : 'border-zinc-800/40 opacity-60'
      }`}
    >
      <div>
        {/* Visual Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
          {s.thumbnailUrl ? (
            <img
              src={s.thumbnailUrl}
              alt={s.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700">
              <ImageIcon size={32} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

          {/* Family & Tag Badges */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/70 backdrop-blur-md text-zinc-300 border border-white/10 uppercase tracking-wider">
              {s.familyId}
            </span>
            {s.tag && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/30 backdrop-blur-md text-purple-200 border border-purple-400/20">
                {s.tag}
              </span>
            )}
          </div>

          {/* Active Toggle Switch Top Right */}
          <button
            onClick={() => onToggleActive(s.id, isItemActive)}
            title={isItemActive ? 'Active (Click to disable)' : 'Disabled (Click to enable)'}
            className={`absolute top-2.5 right-2.5 p-1.5 rounded-xl backdrop-blur-md transition-colors ${
              isItemActive
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-zinc-900/80 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {isItemActive ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          {/* Name in Thumbnail */}
          <div className="absolute bottom-2.5 left-3 right-3">
            <h3 className="text-sm font-bold text-white tracking-tight">{s.name}</h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {s.description && (
            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {s.description}
            </p>
          )}

          {/* Prompt Snippet */}
          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 relative group">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-500 mb-1">
              <span>Style DNA Prompt</span>
              <button
                onClick={() => onCopyPrompt(s.id, s.stylePrompt)}
                className="hover:text-zinc-300 transition-colors"
                title="Copy prompt"
              >
                {copiedId === s.id ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-300 font-mono line-clamp-3 leading-relaxed">
              {s.stylePrompt}
            </p>
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="px-4 py-3 bg-zinc-950/40 border-t border-zinc-800/60 flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-zinc-500">
          Sort #{s.sortOrder ?? 100}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenEdit(s)}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-xs font-semibold flex items-center gap-1 px-2.5"
          >
            <Edit3 size={12} /> Edit
          </button>
          <button
            onClick={() => onDelete(s.id, s.name)}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
            title="Delete style"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
