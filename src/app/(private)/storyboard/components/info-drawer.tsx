'use client';

import { useEffect } from 'react';
import { X, Play, Pause, FileAudio, Palette, Cpu, Zap, Layers } from 'lucide-react';
import type { SceneItem, ProjectManifest, BaseStylePreset } from '@/types';
import type { AIImageModel } from '@/types/subscription';

export function formatDuration(ms: number): string {
  if (!ms) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface InfoDrawerProps {
  open: boolean;
  onClose: () => void;
  project: ProjectManifest | null;
  scenes: SceneItem[];
  stylePreset: BaseStylePreset | null;
  selectedAIModel: AIImageModel | null;
  hasAudio: boolean;
  voiceAudioUrl: string | null;
  isPlayingVoice: boolean;
  voiceCurrentTime: number;
  voiceDuration: number;
  totalDurationSec: number;
  isWorking: boolean;
  onTogglePlayVoice: () => void;
  onSeekVoice: (t: number) => void;
  onSyncTimelineToAudio: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-mono">{value}</span>
    </div>
  );
}

/** Read-only project info: the voice, style and engine this storyboard was built with. */
export default function InfoDrawer(p: InfoDrawerProps) {
  const { open, onClose } = p;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { scenes } = p;
  const hasVoice = p.hasAudio || p.project?.hasCustomVoice || !!p.voiceAudioUrl;
  const imagesReady = scenes.filter((s) =>
    ['IMAGE_READY', 'GENERATING_MOTION', 'MOTION_READY'].includes(s.status)
  ).length;
  const motionReady = scenes.filter((s) => s.status === 'MOTION_READY').length;
  const avgPace = scenes.length > 0 ? (p.totalDurationSec / scenes.length).toFixed(1) : '—';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-bg-base border-l border-bg-border shadow-2xl flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-bg-border">
          <h2 className="text-sm font-semibold text-white">Project info</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Voice */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-2xs font-semibold text-zinc-400 uppercase tracking-wider">
              <FileAudio size={12} /> Voice
            </h3>
            {hasVoice ? (
              <>
                {p.voiceAudioUrl && (
                  <div className="p-2.5 rounded-lg bg-bg-surface border border-bg-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-200 truncate">
                        {p.project?.customAudioFileName || 'Master Voiceover'}
                      </span>
                      <button
                        onClick={p.onTogglePlayVoice}
                        className="theme-dark w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 transition-colors"
                        title={p.isPlayingVoice ? 'Pause' : 'Play'}
                      >
                        {p.isPlayingVoice ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={p.voiceDuration > 0 ? p.voiceDuration : p.totalDurationSec > 0 ? p.totalDurationSec : 1}
                      step={0.1}
                      value={p.voiceCurrentTime}
                      onChange={(e) => p.onSeekVoice(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-2xs text-zinc-500 font-mono">
                      <span>{formatDuration(p.voiceCurrentTime * 1000)}</span>
                      <span>{formatDuration((p.voiceDuration || p.totalDurationSec) * 1000)}</span>
                    </div>
                  </div>
                )}
                <Row label="Type" value={p.project?.hasCustomVoice ? 'Custom upload' : 'AI TTS'} />
                <Row
                  label="Duration"
                  value={`${Math.floor(p.totalDurationSec / 60)}m ${Math.round(p.totalDurationSec % 60)}s`}
                />
                <Row label="Avg. per scene" value={`${avgPace}s`} />
                {scenes.length > 0 && (
                  <button
                    onClick={p.onSyncTimelineToAudio}
                    disabled={p.isWorking}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                    title="Proportionally scale all scene cuts to match voice length"
                  >
                    <Zap size={12} /> Auto-fit scenes to voice
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-500">No voice on this project.</p>
            )}
          </section>

          {/* Style */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-2xs font-semibold text-zinc-400 uppercase tracking-wider">
              <Palette size={12} /> Style
            </h3>
            {p.stylePreset ? (
              <>
                <Row label="Preset" value={p.stylePreset.name} />
                <Row label="Aspect" value={p.project?.aspectRatio || p.stylePreset.aspectRatio} />
                {p.stylePreset.stylePrompt && (
                  <div className="space-y-1">
                    <p className="text-2xs text-zinc-500">Style prompt</p>
                    <p className="text-xs text-zinc-300 leading-relaxed p-2.5 rounded-lg bg-bg-surface border border-bg-border">
                      {p.stylePreset.stylePrompt}
                    </p>
                  </div>
                )}
                {p.stylePreset.negativePrompt && (
                  <div className="space-y-1">
                    <p className="text-2xs text-zinc-500">Negative prompt</p>
                    <p className="text-xs text-zinc-400 leading-relaxed p-2.5 rounded-lg bg-bg-surface border border-bg-border">
                      {p.stylePreset.negativePrompt}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-500">No style preset selected.</p>
            )}
          </section>

          {/* Engine */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-2xs font-semibold text-zinc-400 uppercase tracking-wider">
              <Cpu size={12} /> Image engine
            </h3>
            <Row label="Model" value={p.selectedAIModel?.name || 'Default'} />
            <Row label="Cost" value={`${p.selectedAIModel?.creditCost ?? 2} cr / image`} />
          </section>

          {/* Progress */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-2xs font-semibold text-zinc-400 uppercase tracking-wider">
              <Layers size={12} /> Scenes
            </h3>
            <Row label="Total" value={scenes.length} />
            <Row label="Images ready" value={`${imagesReady} / ${scenes.length}`} />
            <Row label="Motion clips" value={`${motionReady} / ${scenes.length}`} />
          </section>
        </div>
      </aside>
    </>
  );
}
