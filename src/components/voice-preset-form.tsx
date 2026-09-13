'use client';

import { useState, useRef } from 'react';
import {
  Loader2,
  PlayCircle,
  StopCircle,
  Save,
  User,
  Globe,
  Gauge,
  Info,
} from 'lucide-react';
import type { VoicePreset } from '@/types';
import { generatePreviewAudio, base64ToBlobUrl } from '@/lib/gemini';
import { getApiKey } from '@/lib/store';

// ─── Constants ────────────────────────────────────────────────────────────────

const VOICE_CHARACTERS = [
  'Kore', 'Puck', 'Fenrir', 'Aoede', 'Charon', 'Zephyr',
  'Leda', 'Orus', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
];

const ACCENTS = [
  'American English',
  'British English',
  'Australian English',
  'Neutral Global',
  'Indian English',
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoicePresetFormProps {
  preset: Partial<VoicePreset>;
  onChange: (field: keyof VoicePreset, value: string | number | boolean) => void;
  onSave: () => void;
  saving?: boolean;
  isNew?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoicePresetForm({
  preset,
  onChange,
  onSave,
  saving = false,
  isNew = false,
}: VoicePresetFormProps) {
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [previewError, setPreviewError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  function paceLabel(v: number) {
    if (v <= 0.85) return 'Slow';
    if (v <= 0.95) return 'Moderate';
    if (v <= 1.05) return 'Normal';
    if (v <= 1.2) return 'Fast';
    return 'Very Fast';
  }

  async function handlePreview() {
    if (previewState === 'playing') {
      audioRef.current?.pause();
      setPreviewState('idle');
      return;
    }

    setPreviewState('loading');
    setPreviewError('');

    try {
      const apiKey = await getApiKey();
      if (!apiKey) {
        setPreviewError('No API key. Please go to Settings first.');
        setPreviewState('error');
        return;
      }

      const fullPreset: VoicePreset = {
        id: preset.id ?? 'preview',
        name: preset.name ?? 'Preview',
        voiceCharacter: preset.voiceCharacter ?? 'Aoede',
        scene: preset.scene ?? '',
        sampleContext: preset.sampleContext ?? '',
        pace: preset.pace ?? 1.0,
        accent: preset.accent ?? 'American English',
        isDefault: false,
        createdAt: Date.now(),
      };

      const result = await generatePreviewAudio(apiKey, fullPreset);

      // Revoke old blob if any
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = base64ToBlobUrl(result.base64Audio, result.mimeType);

      const audio = new Audio(blobUrlRef.current);
      audioRef.current = audio;
      audio.onended = () => setPreviewState('idle');
      audio.play().catch((playErr) => {
        setPreviewState('error');
        setPreviewError('Playback was prevented by browser autoplay policy.');
      });
      setPreviewState('playing');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      setPreviewState('error');
    }
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Preset Name */}
      <div>
        <label className="label">Preset Name</label>
        <input
          id="preset-name"
          type="text"
          className="input"
          placeholder="e.g. Documentary Narrator"
          value={preset.name ?? ''}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </div>

      {/* Voice Character */}
      <div>
        <label className="label flex items-center gap-1.5">
          <User size={11} />
          Voice Character
        </label>
        <select
          id="voice-character"
          className="input"
          value={preset.voiceCharacter ?? 'Aoede'}
          onChange={(e) => onChange('voiceCharacter', e.target.value)}
        >
          {VOICE_CHARACTERS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {/* Scene */}
      <div>
        <label className="label">Scene</label>
        <input
          id="preset-scene"
          type="text"
          className="input"
          placeholder="e.g. A quiet, professional remote workspace."
          value={preset.scene ?? ''}
          onChange={(e) => onChange('scene', e.target.value)}
        />
        <p className="text-[11px] text-slate-600 mt-1.5">
          Sets the environmental backdrop for how the voice is delivered.
        </p>
      </div>

      {/* Sample Context */}
      <div>
        <label className="label flex items-center gap-1.5">
          Sample Context
          <span className="group relative inline-block">
            <Info size={11} className="text-slate-600 cursor-help" />
            <span className="absolute left-4 -top-1 w-56 text-[11px] text-slate-300
                             bg-bg-elevated border border-bg-border rounded-lg px-3 py-2
                             opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
              Gives the model a contextual starting point, so the voice enters the scene naturally.
            </span>
          </span>
        </label>
        <textarea
          id="preset-sample-context"
          rows={3}
          className="textarea"
          placeholder="e.g. Pace is calm and unhurried. Tone is empathetic, crisp, and reassuring."
          value={preset.sampleContext ?? ''}
          onChange={(e) => onChange('sampleContext', e.target.value)}
        />
      </div>

      {/* Pace Slider */}
      <div>
        <label className="label flex items-center gap-1.5">
          <Gauge size={11} />
          Pace / Speed
        </label>
        <div className="flex items-center gap-4">
          <input
            id="preset-pace"
            type="range"
            min={0.75}
            max={1.5}
            step={0.05}
            value={preset.pace ?? 1.0}
            onChange={(e) => onChange('pace', parseFloat(e.target.value))}
            className="flex-1 accent-accent-purple h-2 rounded-full cursor-pointer"
          />
          <div className="flex flex-col items-end flex-shrink-0 w-20 text-right">
            <span className="text-sm font-semibold text-white tabular-nums">
              {(preset.pace ?? 1.0).toFixed(2)}x
            </span>
            <span className="text-[10px] text-slate-500">{paceLabel(preset.pace ?? 1.0)}</span>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>0.75×</span><span>1.5×</span>
        </div>
      </div>

      {/* Accent */}
      <div>
        <label className="label flex items-center gap-1.5">
          <Globe size={11} />
          Accent / Language Style
        </label>
        <select
          id="preset-accent"
          className="input"
          value={preset.accent ?? 'American English'}
          onChange={(e) => onChange('accent', e.target.value)}
        >
          {ACCENTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Divider */}
      <div className="border-t border-bg-border pt-5">
        {/* Preview Error */}
        {previewState === 'error' && previewError && (
          <p className="text-xs text-red-400 mb-3 p-2.5 rounded-lg bg-red-950/40 border border-red-800/40 animate-fade-in">
            {previewError}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            id="listen-preview-btn"
            onClick={handlePreview}
            disabled={previewState === 'loading'}
            className="btn-secondary flex-1"
          >
            {previewState === 'loading' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : previewState === 'playing' ? (
              <StopCircle size={14} className="text-red-400" />
            ) : (
              <PlayCircle size={14} className="text-accent-cyan" />
            )}
            {previewState === 'loading'
              ? 'Generating…'
              : previewState === 'playing'
              ? 'Stop Preview'
              : 'Listen Preview'}
          </button>

          <button
            id="save-preset-btn"
            onClick={onSave}
            disabled={saving || !preset.name?.trim()}
            className="btn-primary flex-1"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : isNew ? 'Create Preset' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
