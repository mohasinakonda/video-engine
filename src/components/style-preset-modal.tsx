'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Palette,
  Plus,
  Trash2,
  Check,
  Star,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Sparkles,
  Search,
  Wand2,
  Layers,
  Camera,
  Film,
  Clock,
  Sliders,
  CheckCircle2,
  ArrowRight,
  Copy,
  BookOpen,
  Upload,
} from 'lucide-react';
import type { BaseStylePreset } from '@/types';
import {
  getStylePresets,
  saveStylePreset,
  deleteStylePreset,
  setDefaultStylePreset,
  BUILT_IN_STYLE_PRESETS,
  getAdminArtStyles,
} from '@/lib/store';
import { uploadMediaToSupabaseStorage, isSupabaseConfigured } from '@/lib/supabase-service';
import {
  CORE_FAMILIES,
  SUB_STYLES_CATALOG,
  getSubStylesByFamily,
  searchSubStyles,
  SubStylePreset,
  StyleFamily,
} from '@/lib/style-taxonomy';
import { synthesizeUniqueStylePrompt, SynthesizedStyleResult } from '@/lib/style-generator';
import { generateSceneImage } from '@/lib/pollinations';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StylePresetModalProps {
  onClose: () => void;
  onSelect: (preset: BaseStylePreset) => void;
  selectedId?: string;
  initialTab?: 'catalog' | 'architect' | 'library';
}

type ModalTab = 'catalog' | 'architect' | 'library';

const GENRE_OPTIONS = [
  { id: 'documentary', label: 'Documentary & Lore', icon: '🏛️' },
  { id: 'science', label: 'Science & Deep Tech', icon: '🔬' },
  { id: 'philosophy', label: 'Philosophy & Stoicism', icon: '🧠' },
  { id: 'truecrime', label: 'True Crime & Mystery', icon: '🕵️' },
  { id: 'finance', label: 'Finance & Geopolitics', icon: '💰' },
  { id: 'scifi', label: 'Deep Space & Hard Sci-Fi', icon: '🚀' },
  { id: 'horror', label: 'Dark Folklore & Horror', icon: '👻' },
  { id: 'kids', label: 'Fable & Kids Story', icon: '🧸' },
];

const MEDIUM_OPTIONS = [
  {
    id: '35mm Film',
    label: '35mm Cinematic Film',
    thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80',
    desc: 'Photorealistic, anamorphic lens, film grain',
  },
  {
    id: 'Artisan Linocut',
    label: 'Artisan Linocut Relief',
    thumb: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
    desc: 'Chiseled woodblock, fibrous cream paper',
  },
  {
    id: '2D Flat Vector',
    label: '2D Editorial Vector',
    thumb: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80',
    desc: 'Clean geometric forms, modern explainer',
  },
  {
    id: 'Studio Ghibli Anime',
    label: 'Studio Ghibli Watercolor',
    thumb: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80',
    desc: 'Hand-painted gouache, nostalgic skies',
  },
  {
    id: 'Classical Oil Painting',
    label: 'Classical Oil Canvas',
    thumb: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=400&q=80',
    desc: 'Heavy impasto brushwork, museum grandeur',
  },
  {
    id: 'Cyberpunk Neon',
    label: 'Cyberpunk Neon Noir',
    thumb: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=400&q=80',
    desc: 'Rain-slicked asphalt, volumetric fog',
  },
  {
    id: '1970s Polaroid',
    label: '1970s Polaroid SX-70',
    thumb: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=400&q=80',
    desc: 'Soft analog emulsion, warm vintage pastel',
  },
  {
    id: 'Claymation 3D',
    label: 'Claymation Stop-Motion',
    thumb: 'https://images.unsplash.com/photo-1560421683-680b9383563b?auto=format&fit=crop&w=400&q=80',
    desc: 'Handcrafted plasticine, tactile fingerprint warmth',
  },
];

function newEmptyPreset(): BaseStylePreset {
  return {
    id: `style_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    stylePrompt: '',
    negativePrompt: 'plastic 3D, glossy render, cartoon, blurry, low resolution, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: false,
    createdAt: Date.now(),
  };
}

export default function StylePresetModal({
  onClose,
  onSelect,
  selectedId,
  initialTab = 'catalog',
}: StylePresetModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);

  // Catalog State
  const [catalogStyles, setCatalogStyles] = useState<SubStylePreset[]>(SUB_STYLES_CATALOG);
  const [families, setFamilies] = useState<StyleFamily[]>(CORE_FAMILIES);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCatalogPreset, setActiveCatalogPreset] = useState<SubStylePreset>(SUB_STYLES_CATALOG[0]);

  // AI Architect State
  const [selectedGenre, setSelectedGenre] = useState<string>('Documentary & Lore');
  const [selectedMedium, setSelectedMedium] = useState<string>('35mm Film');
  const [userCustomNotes, setUserCustomNotes] = useState<string>('');
  const [architectGenerating, setArchitectGenerating] = useState<boolean>(false);
  const [architectResult, setArchitectResult] = useState<SynthesizedStyleResult | null>(null);

  // Custom Library State
  const [customPresets, setCustomPresets] = useState<BaseStylePreset[]>([]);
  const [editingPreset, setEditingPreset] = useState<BaseStylePreset | null>(null);
  const [isCreatingManual, setIsCreatingManual] = useState<boolean>(false);
  const [libraryUploading, setLibraryUploading] = useState<boolean>(false);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);

  const handleLibraryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingPreset) return;
    setLibraryUploading(true);

    try {
      if (isSupabaseConfigured()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `styles/${Date.now()}_${safeName}`;
        const publicUrl = await uploadMediaToSupabaseStorage('scene-images', path, file);
        if (publicUrl) {
          setEditingPreset((prev) => (prev ? { ...prev, thumbnailUrl: publicUrl } : null));
          setLibraryUploading(false);
          return;
        }
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEditingPreset((prev) => (prev ? { ...prev, thumbnailUrl: reader.result as string } : null));
        }
        setLibraryUploading(false);
      };
      reader.onerror = () => setLibraryUploading(false);
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Library image upload error:', err);
      setLibraryUploading(false);
    }
  };

  // Testing Preview State
  const [testingImageUrl, setTestingImageUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState<boolean>(false);
  const [testError, setTestError] = useState<string>('');

  // Load custom presets from store
  const refreshCustomPresets = async () => {
    const all = await getStylePresets();
    setCustomPresets(all.filter((p) => !p.isBuiltIn));
  };

  useEffect(() => {
    refreshCustomPresets();

    // Fetch dynamic catalog from /api/styles with fallback to SUB_STYLES_CATALOG and local admin overrides
    const fetchCatalog = async () => {
      try {
        let styles: SubStylePreset[] = [];
        const res = await fetch('/api/styles');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.styles) && data.styles.length > 0) {
            styles = data.styles;
            if (data.families && Array.isArray(data.families)) {
              setFamilies(data.families);
            }
          }
        }

        if (styles.length === 0) {
          styles = SUB_STYLES_CATALOG;
        }

        // Merge with local admin overrides
        const localOverrides = getAdminArtStyles();
        if (localOverrides.length > 0) {
          const overrideMap = new Map(localOverrides.map((s) => [s.id, s]));
          styles = styles.map((s) => {
            const override = overrideMap.get(s.id);
            return override ? ({ ...s, ...override } as SubStylePreset) : s;
          });
        }

        setCatalogStyles(styles);
      } catch (err) {
        console.warn('Using local catalog fallback:', err);
      }
    };
    fetchCatalog();
  }, []);

  // Filter Catalog sub-styles
  const displayedCatalogStyles = useMemo(() => {
    let list = catalogStyles;
    if (selectedFamilyId !== 'all') {
      list = list.filter((s) => s.familyId === selectedFamilyId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.tag && s.tag.toLowerCase().includes(q)) ||
          s.stylePrompt.toLowerCase().includes(q)
      );
    }
    return list;
  }, [catalogStyles, selectedFamilyId, searchQuery]);

  // Handle Image Test using Pollinations AI
  const handleTestImageGeneration = async (stylePrompt: string, negativePrompt?: string) => {
    if (!stylePrompt.trim()) return;
    setTesting(true);
    setTestError('');
    setTestingImageUrl(null);

    try {
      const testSubject = 'A majestic ancient valley and cinematic ruins at sunset';
      const arrayBuffer = await generateSceneImage(testSubject, stylePrompt, undefined, {
        model: 'flux',
        negativePrompt,
        aspectRatio: '16:9',
      });
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setTestingImageUrl(url);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test generation failed');
    } finally {
      setTesting(false);
    }
  };

  // Trigger AI Architect Synthesis
  const handleRunAiArchitect = async () => {
    setArchitectGenerating(true);
    setArchitectResult(null);
    setTestError('');
    setTestingImageUrl(null);

    try {
      const result = await synthesizeUniqueStylePrompt({
        genre: selectedGenre,
        medium: selectedMedium,
        userNotes: userCustomNotes,
      });
      setArchitectResult(result);
    } catch (err) {
      setTestError('Failed to synthesize AI style prompt.');
    } finally {
      setArchitectGenerating(false);
    }
  };

  // Apply AI Architect Result to Video
  const handleApplyArchitectResult = async (saveToLibrary = true) => {
    if (!architectResult) return;
    const preset: BaseStylePreset = {
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: architectResult.name,
      stylePrompt: architectResult.stylePrompt,
      negativePrompt: architectResult.negativePrompt,
      aspectRatio: '16:9',
      isDefault: false,
      isBuiltIn: false,
      createdAt: Date.now(),
      tag: selectedGenre,
      description: architectResult.rationale,
      thumbnailUrl: MEDIUM_OPTIONS.find((m) => m.id === selectedMedium)?.thumb,
    };

    if (saveToLibrary) {
      await saveStylePreset(preset);
      await refreshCustomPresets();
    }
    onSelect(preset);
    onClose();
  };

  // Save manual custom preset
  const handleSaveManualPreset = async () => {
    if (!editingPreset || !editingPreset.name.trim() || !editingPreset.stylePrompt.trim()) return;
    await saveStylePreset({
      ...editingPreset,
      createdAt: editingPreset.createdAt || Date.now(),
    });
    await refreshCustomPresets();
    setEditingPreset(null);
    setIsCreatingManual(false);
  };

  const handleDeleteCustom = async (id: string) => {
    await deleteStylePreset(id);
    await refreshCustomPresets();
    if (editingPreset?.id === id) setEditingPreset(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-5xl h-[92vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Palette size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Base Style Presets &amp; AI Architect

              </h2>
              <p className="text-xs text-zinc-400">
                Guaranteed multi-scene visual consistency with tailored art medium anchors
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-md border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('catalog');
                setTestingImageUrl(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${activeTab === 'catalog'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Palette size={13} className="text-emerald-400" />
              <span>Explore Catalog</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('architect');
                setTestingImageUrl(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${activeTab === 'architect'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Wand2 size={13} className="text-amber-400" />
              <span>AI Architect</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('library');
                setTestingImageUrl(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${activeTab === 'library'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <BookOpen size={13} className="text-cyan-400" />
              <span>My Library ({customPresets.length})</span>
            </button>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ─── TAB 1: EXPLORE CATALOG ────────────────────────────────────────── */}
        {activeTab === 'catalog' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left 65%: Filter & Sub-Styles Grid */}
            <div className="flex-1 flex flex-col border-r border-zinc-800 overflow-hidden bg-zinc-950/60">
              {/* Family Filters & Search */}
              <div className="p-4 border-b border-zinc-800/80 space-y-3 bg-zinc-900/30">
                {/* Search Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search sub-styles (e.g. Noir, Ghibli, Linocut, Cyberpunk, 16mm)…"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/60 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {searchQuery.trim() && (
                    <button
                      onClick={() => {
                        setUserCustomNotes(searchQuery);
                        setActiveTab('architect');
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all"
                    >
                      <Sparkles size={12} />
                      <span>Invent &ldquo;{searchQuery.slice(0, 15)}&rdquo;</span>
                    </button>
                  )}
                </div>

                {/* Family Pill Tabs */}
                {!searchQuery && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {families.map((family) => {
                      const isSelected = selectedFamilyId === family.id;
                      return (
                        <button
                          key={family.id}
                          onClick={() => setSelectedFamilyId(family.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${isSelected
                            ? 'bg-zinc-800 text-white border border-zinc-700 font-semibold shadow-xs'
                            : 'bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-850 border border-transparent'
                            }`}
                        >
                          <span>{family.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-Styles Card Grid */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedCatalogStyles.map((style) => {
                  const isCurrent = activeCatalogPreset.id === style.id;
                  const isProjectSelected = selectedId === style.id;

                  return (
                    <div
                      key={style.id}
                      onClick={() => {
                        setActiveCatalogPreset(style);
                        setTestingImageUrl(null);
                        setTestError('');
                      }}
                      className={`group cursor-pointer rounded-md border transition-all flex flex-col justify-between ${isCurrent
                        ? 'border-emerald-500 bg-zinc-900 shadow-md ring-1 ring-emerald-500/40'
                        : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700'
                        }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={style.thumbnailUrl}
                          alt={style.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />
                        <span className="absolute top-2 left-2 text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-zinc-300 border border-white/10">
                          {style.tag}
                        </span>
                        {isProjectSelected && (
                          <span className="absolute top-2 right-2 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 flex items-center gap-1 shadow-sm">
                            <Check size={10} strokeWidth={3} />
                            Active
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3 space-y-1">
                        <h4 className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                          {style.name}
                        </h4>
                        <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {style.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 35%: Style Inspector & Test Preview */}
            <div className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-zinc-900/40 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Active Preview Thumbnail */}
                <div className="rounded-xl overflow-hidden border border-zinc-800 aspect-video relative bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={testingImageUrl || activeCatalogPreset.thumbnailUrl}
                    alt={activeCatalogPreset.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{activeCatalogPreset.name}</p>
                      <p className="text-[10px] text-emerald-400 font-mono">{activeCatalogPreset.tag}</p>
                    </div>
                  </div>
                </div>

                {/* Prompt Breakdown */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Layers size={11} className="text-emerald-400" />
                    <span>Consistency Art Anchor</span>
                  </label>
                  <p className="text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono leading-relaxed">
                    {activeCatalogPreset.stylePrompt}
                  </p>
                </div>

                {/* Negative Constraints */}
                {activeCatalogPreset.negativePrompt && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Negative Exclusions (Anti-Slop)
                    </label>
                    <p className="text-[11px] text-zinc-400 bg-zinc-950/60 border border-zinc-900 rounded-lg p-2 font-mono line-clamp-2">
                      {activeCatalogPreset.negativePrompt}
                    </p>
                  </div>
                )}

                {/* Test Generation Preview */}
                <div className="pt-2">
                  <button
                    onClick={() =>
                      handleTestImageGeneration(
                        activeCatalogPreset.stylePrompt,
                        activeCatalogPreset.negativePrompt
                      )
                    }
                    disabled={testing}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 hover:text-white border border-zinc-700 flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    {testing ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-emerald-400" />
                        <span>Generating Live Sample…</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={13} className="text-emerald-400" />
                        <span>Test Sample Image (Pollinations AI)</span>
                      </>
                    )}
                  </button>

                  {testError && (
                    <p className="text-[11px] text-amber-400 mt-2 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {testError}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 space-y-2">
                <button
                  onClick={() => {
                    onSelect(activeCatalogPreset);
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
                >
                  <CheckCircle2 size={15} />
                  <span>Use &ldquo;{activeCatalogPreset.name}&rdquo;</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: GUIDED AI ARCHITECT ────────────────────────────────────── */}
        {activeTab === 'architect' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left 60%: Guided Questionnaire */}
            <div className="flex-1 flex flex-col border-r border-zinc-800 overflow-y-auto p-6 space-y-6 bg-zinc-950/60">
              {/* Step 1: Video Genre */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  <label className="text-xs font-semibold text-white uppercase tracking-wider">
                    What kind of video are you creating? (Genre / Niche)
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GENRE_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGenre(g.label)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${selectedGenre === g.label
                        ? 'bg-zinc-800 border-emerald-500 text-white font-semibold shadow-xs ring-1 ring-emerald-500/30'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
                        }`}
                    >
                      <span className="text-base mr-1.5">{g.icon}</span>
                      <span className="text-xs">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Core Art Medium with Thumbnails */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <label className="text-xs font-semibold text-white uppercase tracking-wider">
                    Select Core Visual Art Medium
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {MEDIUM_OPTIONS.map((m) => {
                    const isSelected = selectedMedium === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMedium(m.id)}
                        className={`cursor-pointer rounded-xl border overflow-hidden transition-all ${isSelected
                          ? 'bg-zinc-800 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                          }`}
                      >
                        <div className="aspect-[16/10] w-full bg-zinc-950 overflow-hidden relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.thumb} alt={m.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                          <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white truncate max-w-[90%]">
                            {m.label}
                          </span>
                        </div>
                        {/* <p className="p-2 text-[10px] text-zinc-400 line-clamp-2">{m.desc}</p> */}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Custom Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  <label className="text-xs font-semibold text-white uppercase tracking-wider">
                    Any specific creative direction? (Optional)
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={userCustomNotes}
                  onChange={(e) => setUserCustomNotes(e.target.value)}
                  placeholder="e.g. Needs to feel ancient, dusty and mysterious with golden hour light and dramatic shadows…"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/60 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none resize-none font-mono"
                />
              </div>

              {/* Trigger Button */}
              <div>
                <button
                  type="button"
                  onClick={handleRunAiArchitect}
                  disabled={architectGenerating}
                  className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-zinc-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98"
                >
                  {architectGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Synthesizing 5-Layer Visual DNA Anchor…</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      <span>✨ AI Craft My Unique Visual Style</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right 40%: Generated Style Result Panel */}
            <div className="w-80 lg:w-[420px] flex-shrink-0 flex flex-col bg-zinc-900/40 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {!architectResult ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
                      <Sparkles size={24} />
                    </div>
                    <h4 className="text-xs font-semibold text-zinc-400 mb-1">
                      Ready to synthesize your visual style
                    </h4>
                    <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                      Select your genre and preferred art medium on the left, then click &ldquo;AI Craft My Unique Visual Style&rdquo;.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    {/* Header */}
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold mb-1">
                        <Sparkles size={13} />
                        <span>AI Synthesized Visual Signature</span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{architectResult.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 italic leading-relaxed">
                        &ldquo;{architectResult.rationale}&rdquo;
                      </p>
                    </div>

                    {/* Editable Prompt */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Style Anchor Prompt (Immutable)
                      </label>
                      <textarea
                        rows={4}
                        value={architectResult.stylePrompt}
                        onChange={(e) =>
                          setArchitectResult({ ...architectResult, stylePrompt: e.target.value })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 rounded-xl p-2.5 text-xs text-zinc-200 font-mono leading-relaxed"
                      />
                    </div>

                    {/* Negative Prompt */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Negative Constraint Shield
                      </label>
                      <textarea
                        rows={2}
                        value={architectResult.negativePrompt}
                        onChange={(e) =>
                          setArchitectResult({ ...architectResult, negativePrompt: e.target.value })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 rounded-xl p-2.5 text-[11px] text-zinc-400 font-mono leading-relaxed"
                      />
                    </div>

                    {/* Test Image Generation */}
                    <div className="space-y-2">
                      <button
                        onClick={() =>
                          handleTestImageGeneration(
                            architectResult.stylePrompt,
                            architectResult.negativePrompt
                          )
                        }
                        disabled={testing}
                        className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 hover:text-white border border-zinc-700 flex items-center justify-center gap-2 transition-all"
                      >
                        {testing ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-emerald-400" />
                            <span>Generating Live Sample…</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={13} className="text-emerald-400" />
                            <span>Test Live Sample Image</span>
                          </>
                        )}
                      </button>

                      {testingImageUrl && (
                        <div className="rounded-xl overflow-hidden border border-zinc-800 aspect-video relative animate-fade-in bg-zinc-950">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={testingImageUrl}
                            alt="AI test frame"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              {architectResult && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 space-y-2">
                  <button
                    onClick={() => handleApplyArchitectResult(true)}
                    className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
                  >
                    <CheckCircle2 size={15} />
                    <span>Apply Style &amp; Save to Library</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: MY CUSTOM LIBRARY ──────────────────────────────────────── */}
        {activeTab === 'library' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: Preset List */}
            <div className="w-80 flex-shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden bg-zinc-950/60">
              <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Saved Custom Styles
                </span>
                <button
                  onClick={() => {
                    setEditingPreset(newEmptyPreset());
                    setIsCreatingManual(true);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} />
                  <span>New</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {customPresets.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 px-4">
                    <p className="text-xs">No custom styles saved yet.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Use the &ldquo;AI Architect&rdquo; tab to craft your first unique style.
                    </p>
                  </div>
                ) : (
                  customPresets.map((preset) => {
                    const isSelected = editingPreset?.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => {
                          setEditingPreset(preset);
                          setIsCreatingManual(false);
                          setTestingImageUrl(null);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${isSelected
                          ? 'bg-zinc-800 border-zinc-600 text-white font-semibold'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
                          }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium truncate">{preset.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{preset.stylePrompt}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustom(preset.id);
                          }}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Editor */}
            <div className="flex-1 overflow-y-auto p-6 bg-zinc-900/30">
              {!editingPreset ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                  <Palette size={28} className="mb-2 text-zinc-600" />
                  <p className="text-xs">Select a custom style to edit or create a new one.</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-xl animate-fade-in">
                  <h3 className="text-sm font-bold text-white">
                    {isCreatingManual ? 'Create Custom Style' : 'Edit Style'}
                  </h3>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Style Name
                    </label>
                    <input
                      type="text"
                      value={editingPreset.name}
                      onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                      placeholder="e.g. 1970s Warm Kodachrome"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Style Prompt Anchor
                    </label>
                    <textarea
                      rows={4}
                      value={editingPreset.stylePrompt}
                      onChange={(e) =>
                        setEditingPreset({ ...editingPreset, stylePrompt: e.target.value })
                      }
                      placeholder="e.g. 35mm film photography, golden hour lighting, muted warm colors…"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none resize-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Negative Exclusions
                    </label>
                    <textarea
                      rows={2}
                      value={editingPreset.negativePrompt || ''}
                      onChange={(e) =>
                        setEditingPreset({ ...editingPreset, negativePrompt: e.target.value })
                      }
                      placeholder="e.g. plastic 3D, CGI, blurry, text, watermark"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 rounded-xl p-2.5 text-[11px] text-zinc-400 placeholder-zinc-500 focus:outline-none resize-none font-mono"
                    />
                  </div>

                  {/* Reference Thumbnail Image Upload */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Reference Thumbnail Image
                    </label>
                    <input
                      type="file"
                      ref={libraryFileInputRef}
                      onChange={handleLibraryImageUpload}
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                    />

                    {editingPreset.thumbnailUrl ? (
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 group">
                        <img
                          src={editingPreset.thumbnailUrl}
                          alt="Thumbnail Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => libraryFileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Upload size={12} /> Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPreset({ ...editingPreset, thumbnailUrl: undefined })}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => libraryFileInputRef.current?.click()}
                        className="border border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-xl p-3 text-center cursor-pointer transition-colors bg-zinc-950/60 flex items-center justify-center gap-2"
                      >
                        <Upload size={14} className="text-emerald-400" />
                        <span className="text-xs text-zinc-400 hover:text-zinc-200">
                          {libraryUploading ? 'Uploading...' : 'Click to upload style reference image'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleSaveManualPreset}
                      disabled={!editingPreset.name.trim() || !editingPreset.stylePrompt.trim()}
                      className="py-2 px-4 rounded-xl text-xs font-semibold bg-emerald-400 text-zinc-950 hover:bg-emerald-300 transition-colors"
                    >
                      Save Preset
                    </button>
                    <button
                      onClick={() => {
                        onSelect(editingPreset);
                        onClose();
                      }}
                      className="py-2 px-4 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                    >
                      Use For This Video
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
