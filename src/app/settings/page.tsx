'use client';

import { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, AlertTriangle, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { getApiKey, saveApiKey } from '@/lib/store';
import { testApiKey } from '@/lib/gemini';
import type { ApiKeyStatus } from '@/types';

const STATUS_CONFIG = {
  idle: { color: 'text-slate-500', bg: 'bg-slate-800', icon: null, text: '' },
  testing: { color: 'text-blue-400', bg: 'bg-blue-950/60', icon: Loader2, text: 'Validating key…' },
  valid: { color: 'text-emerald-400', bg: 'bg-emerald-950/60', icon: CheckCircle, text: 'Connection successful — API key is valid.' },
  invalid: { color: 'text-red-400', bg: 'bg-red-950/60', icon: XCircle, text: 'Invalid Key. Please check and try again.' },
  quota_exceeded: { color: 'text-amber-400', bg: 'bg-amber-950/60', icon: AlertTriangle, text: 'Quota Exceeded (429). Your key is valid but limit reached.' },
  error: { color: 'text-red-400', bg: 'bg-red-950/60', icon: XCircle, text: 'Network error. Check your internet connection.' },
};

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [status, setStatus] = useState<ApiKeyStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiKey().then((k) => {
      setApiKey(k);
      setSavedKey(k);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    await saveApiKey(apiKey.trim());
    setSavedKey(apiKey.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (status !== 'idle') setStatus('idle');
  }

  async function handleTestKey() {
    const key = apiKey.trim();
    if (!key) return;

    setStatus('testing');
    setStatusMsg('');
    const result = await testApiKey(key);

    if (result.ok) {
      setStatus('valid');
      setStatusMsg('Connection successful — API key is valid.');
    } else {
      const reason = result.reason;
      setStatusMsg(result.message);
      if (reason === 'quota_exceeded') setStatus('quota_exceeded');
      else if (reason === 'network_error') setStatus('error');
      else setStatus('invalid');
    }
  }

  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const isDirty = apiKey.trim() !== savedKey;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure your Gemini API key and preferences</p>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl space-y-6 animate-slide-up">

            {/* BYOK Card */}
            <div className="card">
              {/* Section Title */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-accent-purple/15 border border-accent-purple/25 flex items-center justify-center">
                  <Key size={16} className="text-accent-purple-light" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Gemini API Key</h2>
                  <p className="text-xs text-slate-500">Bring Your Own Key (BYOK)</p>
                </div>
              </div>

              {/* Security Notice */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-bg-base/60 border border-bg-border mb-5">
                <Shield size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your key is stored locally on this device and is <strong className="text-slate-300">never sent to any external server</strong>. Only Gemini API endpoints receive it.
                </p>
              </div>

              {/* API Key Input */}
              <div className="mb-4">
                <label className="label">API Key</label>
                <div className="relative">
                  <input
                    id="api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (status !== 'idle') setStatus('idle');
                    }}
                    placeholder="AIza…"
                    className="input pr-10 font-mono text-xs"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">
                  Get your key at{' '}
                  <span className="text-accent-purple-light cursor-pointer hover:underline"
                    onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}>
                    aistudio.google.com
                  </span>
                </p>
              </div>

              {/* Status Banner */}
              {status !== 'idle' && (
                <div className={`flex items-center gap-2.5 p-3 rounded-lg border mb-4 animate-fade-in
                                 ${cfg.bg} border-${status === 'valid' ? 'emerald' : status === 'quota_exceeded' ? 'amber' : 'red'}-800/40`}>
                  {StatusIcon && (
                    <StatusIcon
                      size={15}
                      className={`${cfg.color} flex-shrink-0 ${status === 'testing' ? 'animate-spin' : ''}`}
                    />
                  )}
                  <p className={`text-xs font-medium ${cfg.color}`}>
                    {statusMsg || cfg.text}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  id="test-key-btn"
                  onClick={handleTestKey}
                  disabled={!apiKey.trim() || status === 'testing'}
                  className="btn-secondary flex-1"
                >
                  {status === 'testing' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  Test Key
                </button>
                <button
                  id="save-key-btn"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="btn-primary flex-1"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : saved ? (
                    <CheckCircle size={14} />
                  ) : null}
                  {saved ? 'Saved!' : 'Save Key'}
                </button>
              </div>
            </div>

            {/* Info Card */}
            <div className="card-elevated border-bg-border/50">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Models Used</h3>
              <div className="space-y-2">
                {[
                  { label: 'Script Chunking', model: 'gemini-2.0-flash', color: 'text-blue-400' },
                  { label: 'Audio Generation (TTS)', model: 'gemini-2.5-flash-preview-tts', color: 'text-accent-purple-light' },
                ].map(({ label, model, color }) => (
                  <div key={model} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-mono ${color}`}>{model}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
