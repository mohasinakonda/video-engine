'use client';

import { Mic2, Star, StarOff, Pencil, Trash2 } from 'lucide-react';
import type { VoicePreset } from '@/types';

interface VoicePresetListProps {
  presets: VoicePreset[];
  selectedId: string | null;
  onSelect: (preset: VoicePreset) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export default function VoicePresetList({
  presets,
  selectedId,
  onSelect,
  onDelete,
  onSetDefault,
}: VoicePresetListProps) {
  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <Mic2 size={28} className="text-slate-700 mb-2" />
        <p className="text-xs text-slate-600">No presets yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {presets.map((preset, idx) => {
        const isSelected = preset.id === selectedId;

        return (
          <div
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={`group relative p-3 rounded-lg border cursor-pointer transition-all duration-150 animate-slide-up
                        ${isSelected
                          ? 'bg-zinc-800/90 border-zinc-600 text-white'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-850'
                        }`}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            {/* Default badge */}
            {preset.isDefault && (
              <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full
                               bg-zinc-800 text-zinc-200 border border-zinc-700">
                Default
              </span>
            )}

            <div className="flex items-start gap-2.5 pr-14">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
                              ${isSelected ? 'bg-white text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                <Mic2 size={13} className={isSelected ? 'text-zinc-950' : 'text-zinc-400'} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{preset.name}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  {preset.voiceCharacter} · {preset.pace.toFixed(2)}× · {preset.accent}
                </p>
                {preset.scene && (
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5 italic">
                    {preset.scene}
                  </p>
                )}
              </div>
            </div>

            {/* Actions (hover) */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                title={preset.isDefault ? 'Default preset' : 'Set as default'}
                onClick={(e) => { e.stopPropagation(); onSetDefault(preset.id); }}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-amber-400 transition-colors"
              >
                {preset.isDefault ? <Star size={12} className="fill-amber-400 text-amber-400" /> : <StarOff size={12} />}
              </button>
              <button
                title="Edit preset"
                onClick={(e) => { e.stopPropagation(); onSelect(preset); }}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
              >
                <Pencil size={11} />
              </button>
              <button
                title="Delete preset"
                onClick={(e) => { e.stopPropagation(); onDelete(preset.id); }}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
