import { showToast } from "@/lib/toast";
import { Bookmark, Loader2, Lock, Pause, Trash2, Play, Upload } from "lucide-react";
import { useState, useRef, useCallback } from "react";

interface CustomVoice {
  id: string;
  name: string;
  deepinfra_voice_id: string;
  voice_prompt?: string;
  sample_audio_url?: string;
  gender?: string;
  language?: string;
  created_at: string;
}
type Props = {
  customVoices: CustomVoice[];
  selectedCustomVoice: CustomVoice | null;
  setSelectedCustomVoice: (voice: CustomVoice | null) => void;
  loadingCustomVoices: boolean;
  handleToggleAudition: (voice: CustomVoice, e: React.MouseEvent) => void;

  auditionPlayingId: string | null;
  setCustomVoices: React.Dispatch<React.SetStateAction<CustomVoice[]>>;
  charsPerCredit: number;
  insertTagIntoVoice: (voiceId: string) => void;
  onOpenCloneModal?: () => void;
}
export const SidebarContent = ({ customVoices, loadingCustomVoices, selectedCustomVoice, setSelectedCustomVoice, handleToggleAudition, auditionPlayingId, setCustomVoices, charsPerCredit, insertTagIntoVoice, onOpenCloneModal }: Props) => {

  const [sidebarTab, setSidebarTab] = useState<'saved' | 'settings'>('saved');
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const handleDeleteVoice = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved voice?')) return;

    try {
      const res = await fetch(`/api/voice/custom-voices?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete voice.');

      setCustomVoices((prev) => prev.filter((v) => v.id !== id));
      if (selectedCustomVoice?.id === id) {
        setSelectedCustomVoice(null);
      }
      showToast('Custom voice deleted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete voice.', 'error');
    }
  }, [selectedCustomVoice]);
  return (

    <div
      ref={dropdownRef}
      className="w-80 lg:w-96 flex-shrink-0 border-l border-bg-border bg-bg-surface flex flex-col min-h-0"
    >
      {/* Sidebar Nav Tabs */}
      <div className="h-11 border-b border-bg-border flex items-center px-4 gap-4 text-xs font-medium">

        <button
          onClick={() => {
            setSidebarTab('saved');

          }}
          className={`pb-2.5 pt-3 transition-colors relative flex items-center gap-1.5 ${sidebarTab === 'saved' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
        >
          <span>My Voices</span>
          {customVoices.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-2xs font-mono bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
              {customVoices.length}
            </span>
          )}
          {sidebarTab === 'saved' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>
        <button
          onClick={() => {
            setSidebarTab('settings');

          }}
          className={`pb-2.5 pt-3 transition-colors relative ${sidebarTab === 'settings' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
        >
          Parameters
          {sidebarTab === 'settings' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">


        {sidebarTab === 'saved' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bookmark size={13} className="text-emerald-400" />
                <span className="text-xxs font-semibold uppercase tracking-wider text-zinc-300">
                  Saved Voice Profiles ({customVoices.length})
                </span>
              </div>
              {onOpenCloneModal && (
                <button
                  type="button"
                  onClick={onOpenCloneModal}
                  className="px-2 py-1 rounded-md text-2xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/80 border border-emerald-800/50 flex items-center gap-1 transition-colors"
                  title="Upload audio sample to clone"
                >
                  <Upload size={11} />
                  <span>Clone</span>
                </button>
              )}
            </div>

            {loadingCustomVoices ? (
              <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                <Loader2 size={16} className="animate-spin text-zinc-400" />
                Loading your voice library...
              </div>
            ) : customVoices.length === 0 ? (
              <div className="p-6 rounded-xl border border-bg-border bg-bg-elevated text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center mx-auto">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-white">No Saved Voices Yet</h5>
                  <p className="text-xxs text-zinc-400 mt-1 leading-relaxed">
                    Upload an audio sample to clone any voice, or design a synthetic voice with AI.
                  </p>
                </div>
                {onOpenCloneModal && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onOpenCloneModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-2xs text-white font-medium transition-colors"
                    >
                      <Upload size={12} className="text-emerald-400" />
                      <span>Upload Sample to Clone</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {customVoices.map((voice) => {
                  const isSelected = selectedCustomVoice?.id === voice.id;
                  const isPlayingThis = auditionPlayingId === voice.id;
                  return (
                    <div
                      key={voice.id}
                      onClick={() => setSelectedCustomVoice(isSelected ? null : voice)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${isSelected
                        ? 'bg-zinc-800/80 border-white/40 shadow-sm ring-1 ring-white/10'
                        : 'bg-bg-elevated hover:bg-bg-elevated/80 border-bg-border'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggleAudition(voice, e)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isPlayingThis
                              ? 'bg-white text-zinc-950 shadow-md'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700'
                              }`}
                            title={isPlayingThis ? 'Pause sample' : 'Listen to 5s voice sample'}
                          >
                            {isPlayingThis ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
                          </button>

                          <div>
                            <h5 className="text-xs font-semibold text-white flex items-center gap-1.5">
                              {voice.name}
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded text-3xs font-mono font-medium bg-zinc-700 text-zinc-200 border border-zinc-600">
                                  Active
                                </span>
                              )}
                            </h5>
                            <div className="flex items-center gap-1.5 text-2xs text-zinc-400 mt-0.5">
                              <span>{voice.language || 'English'}</span>
                              <span>·</span>
                              <span className="capitalize">{voice.gender || 'neutral'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVoice(voice.id, e)}
                            className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                            title="Delete saved voice"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {voice.voice_prompt && (
                        <p className="text-xxs text-zinc-400 line-clamp-2 bg-bg-base p-2 rounded-lg border border-bg-border font-mono">
                          {voice.voice_prompt}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-bg-border text-2xs text-zinc-500">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Lock size={10} /> Timbre Locked
                        </span>
                        <span className="text-zinc-400 font-medium hover:underline">
                          {isSelected ? 'Click to deselect' : 'Use this voice →'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {sidebarTab === 'settings' && (
          <div className="space-y-5">
            {/* Model Info Card */}
            <div className="p-3.5 rounded-xl border border-bg-border bg-bg-elevated space-y-2">
              <div className="text-xs font-semibold text-white flex items-center justify-between">
                <span>Model Specs</span>
                <span className="text-2xs text-emerald-400 font-mono">Active</span>
              </div>

              <p className="text-xxs text-zinc-500 leading-relaxed">
                Zero-shot prompt-guided speech synthesis via cloud inference.
              </p>
              <div className="pt-2 border-t border-bg-border flex items-center justify-between text-xs text-zinc-400">
                <span>Billing Rate</span>
                <span className="font-mono text-zinc-200">1 credit / {charsPerCredit.toLocaleString()} chars</span>
              </div>
            </div>

            {/* Quick Acoustic Dimension Chips */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                Acoustic Dimension Chips
              </span>
              <p className="text-xxs text-zinc-500">Click to append to your voice description:</p>

              <div className="space-y-2">
                <div>
                  <span className="text-xxs text-zinc-400 font-medium block mb-1">Age & Gender</span>
                  <div className="flex flex-wrap gap-1">
                    {['young woman in 20s', 'middle-aged man in 50s', 'elderly gentleman'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => insertTagIntoVoice(chip)}
                        className="text-xxs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700 transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xxs text-zinc-400 font-medium block mb-1">Texture</span>
                  <div className="flex flex-wrap gap-1">
                    {['deep and gravelly', 'silky, mellow, and magnetic', 'breathy and soft'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => insertTagIntoVoice(chip)}
                        className="text-xxs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700 transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xxs text-zinc-400 font-medium block mb-1">Mood</span>
                  <div className="flex flex-wrap gap-1">
                    {['blunt and matter-of-fact', 'warm and confident', 'gentle with weariness', 'slow and deliberate'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => insertTagIntoVoice(chip)}
                        className="text-xxs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700 transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Best Outcome Tips */}
            <div className="p-3.5 rounded-xl border border-bg-border bg-bg-elevated space-y-2 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200 block">MiMo Acoustic Guidelines:</span>
              <ul className="space-y-1 list-disc list-inside text-xxs text-zinc-400">
                <li>Include [Gender] + [Texture] + [Mood] + [Pace].</li>
                <li>Avoid audio terms like "reverb" or "EQ".</li>
                <li>Use parentheses tags e.g. <code className="text-zinc-200 font-mono">(whispers)</code> for emotion.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}