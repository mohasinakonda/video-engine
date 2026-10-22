'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  Play,
  Pause,
  Loader2,
  FileAudio,
  CheckCircle2,
  Volume2,
  RotateCcw,
} from 'lucide-react';
import { processAudioFileForCloning } from '@/lib/audio-encoder';
import { showToast } from '@/lib/toast';
import { TEXT_LIMITS } from '@/lib/input-limits';

export interface CustomVoice {
  id: string;
  name: string;
  deepinfra_voice_id: string;
  voice_prompt?: string;
  sample_audio_url?: string;
  gender?: string;
  language?: string;
  created_at: string;
}

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceCreated: (voice: CustomVoice) => void;
  /** Current number of saved voices — shown as X/5 (server enforces the cap). */
  existingCount?: number;
}

const LANGUAGE_OPTIONS = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Korean',
  'Chinese',
  'Arabic',
  'Russian',
  'Turkish',
];

export function VoiceCloneModal({
  isOpen,
  onClose,
  onVoiceCreated,
  existingCount = 0,
}: VoiceCloneModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);

  // Form states
  const [voiceName, setVoiceName] = useState('');
  const [language, setLanguage] = useState('English');
  const [gender, setGender] = useState('Male');
  const [voicePrompt, setVoicePrompt] = useState('A natural, clear, and engaging voice.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setAudioBase64(null);
    setPreviewUrl(null);
    setDuration(0);
    setIsPlaying(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  const handleAudioFile = useCallback(
    async (selectedFile: File) => {
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/webm'];
      const isAudio = selectedFile.type.startsWith('audio/') || validTypes.includes(selectedFile.type) || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(selectedFile.name);

      if (!isAudio) {
        showToast('Please upload a valid audio file (.mp3, .wav, .m4a, etc.)', 'error');
        return;
      }

      try {
        setIsProcessingAudio(true);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);

        const result = await processAudioFileForCloning(selectedFile, 12);
        setFile(selectedFile);
        setAudioBase64(result.base64);
        setPreviewUrl(result.previewUrl);
        setDuration(result.duration);

        // Auto suggest name if not filled
        if (!voiceName.trim()) {
          const rawName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          const formatted = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          setVoiceName(formatted.slice(0, TEXT_LIMITS.voiceName));
        }

        showToast('Voice sample loaded & optimized!', 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not process audio';
        console.error('Audio processing failed:', err);
        showToast(`Failed to process audio: ${msg}`, 'error');
      } finally {
        setIsProcessingAudio(false);
      }
    },
    [voiceName]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleAudioFile(e.dataTransfer.files[0]);
      }
    },
    [handleAudioFile]
  );

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const handleCloneSubmit = useCallback(async () => {
    if (isSubmitting) return;
    if (!voiceName.trim()) {
      showToast('Please enter a name for your cloned voice.', 'error');
      return;
    }
    if (!audioBase64) {
      showToast('Please upload an audio sample to clone.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/voice/custom-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clone',
          name: voiceName.trim(),
          audioBase64,
          voicePrompt: voicePrompt.trim(),
          language,
          gender,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clone voice.');

      showToast(`🎉 Cloned voice "${data.voice.name}" created successfully!`, 'success');
      onVoiceCreated(data.voice);
      resetAudio();
      setVoiceName('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clone voice.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, voiceName, audioBase64, voicePrompt, language, gender, onVoiceCreated, resetAudio, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-bg-border bg-bg-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white shadow-sm">
              <Volume2 size={18} className="text-zinc-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Clone Voice</h3>
                <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                  Instant Clone
                </span>
                {/* Server enforces max 5 voices + 15 credit charge */}
                <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {existingCount}/5 voices
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Upload a 5–30s clean voice sample to clone any voice · Costs 15 credits
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetAudio();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Audio Upload Zone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Voice Sample Audio</span>
              <span className="text-2xs text-zinc-500 font-normal">MP3, WAV, M4A (5–30 sec)</span>
            </label>

            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-white bg-zinc-800/80 scale-[0.99]'
                    : 'border-zinc-700/80 hover:border-zinc-500 bg-bg-elevated/40 hover:bg-bg-elevated'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleAudioFile(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shadow-sm">
                  {isProcessingAudio ? (
                    <Loader2 size={20} className="animate-spin text-white" />
                  ) : (
                    <Upload size={20} />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-white">
                    {isProcessingAudio
                      ? 'Processing & converting audio sample...'
                      : 'Click to upload or drag & drop voice file'}
                  </p>
                  <p className="text-2xs text-zinc-400">
                    Use clear speech without background music or noise for best cloning fidelity
                  </p>
                </div>
              </div>
            ) : (
              /* Uploaded Audio Preview Card */
              <div className="p-4 rounded-xl border border-bg-border bg-bg-elevated flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="w-10 h-10 rounded-full bg-white text-zinc-950 flex items-center justify-center flex-shrink-0 shadow hover:bg-zinc-200 transition-colors"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileAudio size={14} className="text-emerald-400 flex-shrink-0" />
                      <p className="text-xs font-semibold text-white truncate max-w-[220px]">
                        {file.name}
                      </p>
                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                    </div>
                    <p className="text-2xs text-zinc-400 mt-0.5">
                      Sample length: {duration.toFixed(1)}s • 24kHz Mono WAV
                    </p>
                  </div>
                </div>

                {previewUrl && (
                  <audio
                    ref={audioRef}
                    src={previewUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                )}

                <button
                  type="button"
                  onClick={resetAudio}
                  className="px-2.5 py-1.5 rounded-lg text-2xs text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 flex items-center gap-1.5 transition-colors flex-shrink-0"
                >
                  <RotateCcw size={12} />
                  <span>Replace</span>
                </button>
              </div>
            )}
          </div>

          {/* Voice Details */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                Voice Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={voiceName}
                maxLength={TEXT_LIMITS.voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="e.g., Hazrat Voice, David Narrator"
                className="w-full px-3 py-2 text-xs rounded-xl bg-bg-surface border border-bg-border text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-bg-surface border border-bg-border text-white focus:outline-none focus:border-zinc-400"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang} className="bg-zinc-900 text-white">
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-bg-surface border border-bg-border text-white focus:outline-none focus:border-zinc-400"
                >
                  <option value="Male" className="bg-zinc-900 text-white">Male</option>
                  <option value="Female" className="bg-zinc-900 text-white">Female</option>
                  <option value="Neutral" className="bg-zinc-900 text-white">Neutral</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                Speaking Style / Direction Prompt (Optional)
              </label>
              <input
                type="text"
                value={voicePrompt}
                maxLength={TEXT_LIMITS.voiceDescription}
                onChange={(e) => setVoicePrompt(e.target.value)}
                placeholder="e.g. Natural, confident, clear documentary narrator"
                className="w-full px-3 py-2 text-xs rounded-xl bg-bg-surface border border-bg-border text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-bg-border bg-bg-surface flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              resetAudio();
              onClose();
            }}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCloneSubmit}
            disabled={isSubmitting || !audioBase64 || !voiceName.trim()}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Registering Clone...</span>
              </>
            ) : (
              <>
                <Volume2 size={14} />
                <span>Clone Voice · 15 credits</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
