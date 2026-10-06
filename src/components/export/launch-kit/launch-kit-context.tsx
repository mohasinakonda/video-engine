'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import type {
  ProjectManifest,
  YouTubePackagingData,
  ThumbnailConcept,
  BaseStylePreset,
} from '@/types';
import {
  saveProject,
  getStylePresets,
  getDefaultStylePreset,
  getYouTubeApiKey,
  getPollinationsApiKey,
  getPollinationsImageModel,
} from '@/lib/store';
import {
  getUserCreditsRemaining,
  deductUserCredits,
  grantUserCredits,
  hasEnoughCredits,
} from '@/lib/subscription-store';
import { generateImage, base64ToUint8Array } from '@/lib/gemini';
import { saveMediaBlob } from '@/lib/media-storage';

interface LaunchKitContextValue {
  // Core project & packaging
  project: ProjectManifest;
  packaging: YouTubePackagingData | undefined;
  onUpdateProject: (updated: ProjectManifest) => void;
  showToast: (msg: string) => void;
  userCredits: number;

  // Voice script
  voiceScript: string;
  setVoiceScript: (val: string) => void;
  isScriptSaved: boolean;
  handleSaveScriptOnly: () => Promise<void>;
  scriptWordCount: number;
  scriptCharCount: number;

  // Custom focus & style preset
  customFocus: string;
  setCustomFocus: (val: string) => void;
  stylePreset: BaseStylePreset | null;

  // Packaging generation
  isGenerating: boolean;
  errorMessage: string | null;
  handleGeneratePackaging: () => Promise<void>;

  // Copy helper
  copiedKey: string | null;
  handleCopy: (text: string, key: string, label: string) => void;
  handleCopyMasterLaunchPack: () => void;

  // Competitor research & Standout test
  competitorSearchInput: string;
  setCompetitorSearchInput: (val: string) => void;
  isSearchingCompetitors: boolean;
  handleSearchCompetitors: (queryToSearch?: string) => Promise<void>;
  standoutMode: boolean;
  setStandoutMode: (val: boolean) => void;

  // Titles
  selectedTitle: string;
  handleSelectTitle: (idx: number) => Promise<void>;

  // Mockup view mode
  mockupViewMode: 'mobile' | 'desktop' | 'shorts';
  setMockupViewMode: (val: 'mobile' | 'desktop' | 'shorts') => void;

  // Thumbnails
  activeThumbnail: string;
  activeConceptId: string | null;
  setActiveConceptId: (id: string | null) => void;
  activeConcept: ThumbnailConcept | null;
  conceptEditMode: Record<string, boolean>;
  setConceptEditMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  generatingThumbId: string | null;
  enhancingThumbId: string | null;
  handleUpdateConceptPrompt: (id: string, newPrompt: string) => Promise<void>;
  handleUpdateConceptText: (id: string, newText: string) => Promise<void>;
  handleResetConceptPrompt: (id: string) => Promise<void>;
  handleEnhanceConceptPrompt: (concept: ThumbnailConcept) => Promise<void>;
  handleAddCustomConcept: () => Promise<void>;
  handleDeleteConcept: (id: string) => Promise<void>;
  handleGenerateThumbnail: (concept: ThumbnailConcept) => Promise<void>;
  handleUpdateBadge: (
    conceptId: string,
    badgeText: string,
    color?: 'yellow' | 'red' | 'white' | 'cyan',
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'center'
  ) => Promise<void>;
  handleDownloadThumbnail: (concept: ThumbnailConcept) => void;

  // Format helpers
  isVertical: boolean;
  durationStr: string;
}

const LaunchKitContext = createContext<LaunchKitContextValue | null>(null);

export function useLaunchKit(): LaunchKitContextValue {
  const ctx = useContext(LaunchKitContext);
  if (!ctx) {
    throw new Error('useLaunchKit must be used within a LaunchKitProvider');
  }
  return ctx;
}

interface LaunchKitProviderProps {
  project: ProjectManifest;
  onUpdateProject: (updated: ProjectManifest) => void;
  showToast: (msg: string) => void;
  children: ReactNode;
}

export function LaunchKitProvider({
  project,
  onUpdateProject,
  showToast,
  children,
}: LaunchKitProviderProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatingThumbId, setGeneratingThumbId] = useState<string | null>(null);
  const [enhancingThumbId, setEnhancingThumbId] = useState<string | null>(null);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [conceptEditMode, setConceptEditMode] = useState<Record<string, boolean>>({});

  // Editable Voice Script State (initialized from project.rawScript)
  const [voiceScript, setVoiceScript] = useState(project.rawScript || '');
  const [customFocus, setCustomFocus] = useState(project.youtubePackaging?.customTopicPrompt || '');
  const [isScriptSaved, setIsScriptSaved] = useState(false);
  const [stylePreset, setStylePreset] = useState<BaseStylePreset | null>(null);

  // User credits & Creator Testing states
  const [userCredits, setUserCredits] = useState<number>(() => {
    return typeof window !== 'undefined' ? getUserCreditsRemaining() : 70;
  });
  const [standoutMode, setStandoutMode] = useState(false);
  const [mockupViewMode, setMockupViewMode] = useState<'mobile' | 'desktop' | 'shorts'>('mobile');

  useEffect(() => {
    function updateCredits() {
      setUserCredits(getUserCreditsRemaining());
    }
    updateCredits();
    window.addEventListener('credits_updated', updateCredits);
    return () => window.removeEventListener('credits_updated', updateCredits);
  }, []);

  const packaging = project.youtubePackaging;
  const isVertical = project.aspectRatio === '9:16';

  const [competitorSearchInput, setCompetitorSearchInput] = useState(
    packaging?.marketInsights?.marketSearchQuery || ''
  );
  const [isSearchingCompetitors, setIsSearchingCompetitors] = useState(false);

  useEffect(() => {
    if (packaging?.marketInsights?.marketSearchQuery) {
      setCompetitorSearchInput(packaging.marketInsights.marketSearchQuery);
    }
  }, [packaging?.marketInsights?.marketSearchQuery]);

  // Load project's active style preset
  useEffect(() => {
    async function loadPreset() {
      const presets = await getStylePresets();
      if (project.baseStylePresetId) {
        const found = presets.find((p) => p.id === project.baseStylePresetId);
        if (found) {
          setStylePreset(found);
          return;
        }
      }
      const def = await getDefaultStylePreset();
      setStylePreset(def);
    }
    loadPreset();
  }, [project.baseStylePresetId]);

  // Sync script if project updates externally
  useEffect(() => {
    if (project.rawScript && project.rawScript !== voiceScript && !isScriptSaved) {
      setVoiceScript(project.rawScript);
    }
  }, [project.rawScript]);

  const handleSaveScriptOnly = async () => {
    const updated: ProjectManifest = {
      ...project,
      rawScript: voiceScript,
      updatedAt: Date.now(),
    };
    await saveProject(updated);
    onUpdateProject(updated);
    setIsScriptSaved(true);
    showToast('Voice script saved to project!');
    setTimeout(() => setIsScriptSaved(false), 2500);
  };

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`${label} copied to clipboard!`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleSearchCompetitors = async (queryToSearch?: string) => {
    const query = (queryToSearch || competitorSearchInput).trim();
    if (!query) {
      showToast('Please enter a search query for competitor benchmarks');
      return;
    }

    setIsSearchingCompetitors(true);
    try {
      const userApiKey = await getYouTubeApiKey();

      const res = await fetch('/api/search-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          youtubeApiKey: userApiKey,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to search competitor videos');
      }

      const data = await res.json();
      const updatedPackaging: YouTubePackagingData = {
        ...(packaging as YouTubePackagingData),
        marketInsights: {
          ...(packaging?.marketInsights || { packagingStrategy: 'Curiosity-driven packaging' }),
          competitorVideos: data.competitorVideos || [],
          marketSearchQuery: data.query,
        },
      };

      const updated: ProjectManifest = {
        ...project,
        youtubePackaging: updatedPackaging,
      };

      setCompetitorSearchInput(data.query);
      await saveProject(updated);
      onUpdateProject(updated);
    } catch (err: any) {
      console.error('Error searching competitors:', err);
      showToast(`Search failed: ${err.message}`);
    } finally {
      setIsSearchingCompetitors(false);
    }
  };

  const handleGeneratePackaging = async () => {
    const cleanScript = voiceScript.trim();
    if (!cleanScript) {
      showToast('Please enter or paste your voice script below first!');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      showToast('AI analyzing voice script & researching YouTube market...');
      const userApiKey = await getYouTubeApiKey();

      // Ensure script is saved to project manifest
      const updatedWithScript: ProjectManifest = {
        ...project,
        rawScript: cleanScript,
        updatedAt: Date.now(),
      };
      await saveProject(updatedWithScript);
      onUpdateProject(updatedWithScript);

      const res = await fetch('/api/generate-packaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          script: cleanScript,
          scenes: project.scenes || [],
          totalDurationMs: project.totalDurationMs || 0,
          customTopicPrompt: customFocus.trim(),
          baseStylePreset: stylePreset,
          aspectRatio: project.aspectRatio || '16:9',
          youtubeApiKey: userApiKey,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'AI service generation failed. Please retry.');
      }

      const data: YouTubePackagingData = await res.json();
      const updated: ProjectManifest = {
        ...updatedWithScript,
        youtubePackaging: {
          ...data,
          customTopicPrompt: customFocus.trim(),
          selectedThumbnailUrl: packaging?.selectedThumbnailUrl || data.selectedThumbnailUrl,
        },
      };

      if (data.marketInsights?.marketSearchQuery) {
        setCompetitorSearchInput(data.marketInsights.marketSearchQuery);
      }

      await saveProject(updated);
      onUpdateProject(updated);
      showToast('100% Genuine AI YouTube Launch Kit generated!');
    } catch (err: any) {
      console.error('Error generating packaging:', err);
      setErrorMessage(err.message || 'AI generation failed. Please try again.');
      showToast(err.message || 'AI generation failed. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectTitle = async (idx: number) => {
    if (!packaging) return;
    const updatedPackaging: YouTubePackagingData = {
      ...packaging,
      selectedTitleIndex: idx,
    };
    const updated: ProjectManifest = {
      ...project,
      youtubePackaging: updatedPackaging,
    };
    await saveProject(updated);
    onUpdateProject(updated);
  };

  const handleUpdateConceptPrompt = async (id: string, newPrompt: string) => {
    if (!packaging?.thumbnailConcepts) return;
    const updatedConcepts = packaging.thumbnailConcepts.map((c) =>
      c.id === id ? { ...c, visualPrompt: newPrompt } : c
    );
    const updatedPackaging: YouTubePackagingData = {
      ...packaging,
      thumbnailConcepts: updatedConcepts,
    };
    const updated: ProjectManifest = {
      ...project,
      youtubePackaging: updatedPackaging,
    };
    await saveProject(updated);
    onUpdateProject(updated);
  };

  const handleUpdateConceptText = async (id: string, newText: string) => {
    if (!packaging?.thumbnailConcepts) return;
    const updatedConcepts = packaging.thumbnailConcepts.map((c) =>
      c.id === id ? { ...c, textOverlayHint: newText } : c
    );
    const updatedPackaging: YouTubePackagingData = {
      ...packaging,
      thumbnailConcepts: updatedConcepts,
    };
    const updated: ProjectManifest = {
      ...project,
      youtubePackaging: updatedPackaging,
    };
    await saveProject(updated);
    onUpdateProject(updated);
  };



  const handleResetConceptPrompt = async (id: string) => {
    if (!packaging?.thumbnailConcepts) return;
    const concept = packaging.thumbnailConcepts.find((c) => c.id === id);
    if (!concept || !concept.originalPrompt) return;
    await handleUpdateConceptPrompt(id, concept.originalPrompt);
    showToast('Prompt reset to original AI baseline!');
  };

  const handleEnhanceConceptPrompt = async (concept: ThumbnailConcept) => {
    if (!concept.visualPrompt.trim()) {
      showToast('Please enter a draft visual prompt to enhance');
      return;
    }
    setEnhancingThumbId(concept.id);
    try {
      showToast('✨ Elevating prompt with cinematic optics, chiaroscuro lighting & micro-textures...');
      const res = await fetch('/api/enhance-thumbnail-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: concept.visualPrompt.trim(),
          coreTopic: packaging?.scriptIntelligence?.coreTopic || project.title || '',
          styleName: stylePreset?.name || 'Cinematic Documentary',
          stylePrompt: stylePreset?.stylePrompt || 'Cinematic lighting, 8k, photorealistic',
          aspectRatio: project.aspectRatio === '9:16' ? '9:16' : '16:9',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to enhance prompt');
      }

      const data = await res.json();
      if (!data.enhancedPrompt) {
        throw new Error('No enhanced prompt returned');
      }

      await handleUpdateConceptPrompt(concept.id, data.enhancedPrompt);
      showToast('✨ Visual prompt elevated to masterwork quality!');
    } catch (err: any) {
      console.error('Enhance prompt failed:', err);
      showToast(`Enhancement failed: ${err.message}`);
    } finally {
      setEnhancingThumbId(null);
    }
  };

  const handleAddCustomConcept = async () => {
    const currentConcepts = packaging?.thumbnailConcepts || [];
    const newId = `thumb_${Date.now()}`;
    const newConcept: ThumbnailConcept = {
      id: newId,
      conceptName: `Custom Idea #${currentConcepts.length + 1}`,
      compositionType: 'custom',
      visualHook: 'Custom creator-defined thumbnail prompt and composition.',
      visualPrompt: '',
      textOverlayHint: 'CUSTOM HOOK',
    };
    const updatedConcepts = [...currentConcepts, newConcept];
    const updatedPackaging: YouTubePackagingData = {
      ...(packaging || {
        scriptIntelligence: {
          coreTopic: 'Custom topic',
          narrativeSummary: '',
          keyTalkingPoints: [],
          targetAudience: 'General Audience',
          searchKeywords: [],
        },
        marketInsights: {
          packagingStrategy: 'High-contrast thumbnails perform best',
          competitorVideos: [],
          marketSearchQuery: '',
        },
        titles: [],
        selectedTitleIndex: 0,
        description: '',
        chapters: [],
        tags: [],
        hashtags: [],
        thumbnailConcepts: [],
      }),
      thumbnailConcepts: updatedConcepts,
    };
    const updated: ProjectManifest = {
      ...project,
      youtubePackaging: updatedPackaging,
    };
    setActiveConceptId(newId);
    setConceptEditMode((prev) => ({ ...prev, [newId]: true }));
    await saveProject(updated);
    onUpdateProject(updated);
    showToast('New custom thumbnail idea card added!');
  };

  const handleDeleteConcept = async (id: string) => {
    if (!packaging?.thumbnailConcepts) return;
    const updatedConcepts = packaging.thumbnailConcepts.filter((c) => c.id !== id);
    const updatedPackaging: YouTubePackagingData = {
      ...packaging,
      thumbnailConcepts: updatedConcepts,
      selectedThumbnailUrl:
        packaging.selectedThumbnailUrl ===
          packaging.thumbnailConcepts.find((c) => c.id === id)?.imageUrl
          ? undefined
          : packaging.selectedThumbnailUrl,
    };
    const updated: ProjectManifest = {
      ...project,
      youtubePackaging: updatedPackaging,
    };
    if (activeConceptId === id) {
      setActiveConceptId(updatedConcepts[0]?.id || null);
    }
    await saveProject(updated);
    onUpdateProject(updated);
    showToast('Thumbnail card removed');
  };

  const handleGenerateThumbnail = async (concept: ThumbnailConcept) => {
    if (!concept.visualPrompt.trim()) {
      showToast('Please enter a visual prompt before generating');
      return;
    }

    if (!hasEnoughCredits(1)) {
      showToast('⚠️ Insufficient credits. Please upgrade or purchase credits to generate a thumbnail.');
      return;
    }

    const deducted = deductUserCredits(1, 'YouTube Thumbnail generation');
    if (!deducted) {
      showToast('⚠️ Could not deduct credit. Insufficient balance or account blocked.');
      return;
    }

    setGeneratingThumbId(concept.id);
    try {
      showToast(`Generating high-res thumbnail with Pollinations (${project.aspectRatio || '16:9'})...`);

      const apiKey = (await getPollinationsApiKey()) || '';
      const chosenModel = await getPollinationsImageModel();
      const isVertical = project.aspectRatio === '9:16';

      let imageUrl = '';

      try {
        // Primary: Direct high-speed client-side generation (same engine as Storyboard)
        const result = await generateImage(
          apiKey,
          concept.visualPrompt.trim(),
          stylePreset?.negativePrompt,
          {
            model: chosenModel,
            baseStyle: stylePreset?.stylePrompt,
            aspectRatio: isVertical ? '9:16' : '16:9',
            width: isVertical ? 1080 : 1920,
            height: isVertical ? 1920 : 1080,
          }
        );

        if (result.base64Image) {
          imageUrl = result.base64Image.startsWith('data:')
            ? result.base64Image
            : `data:${result.mimeType || 'image/jpeg'};base64,${result.base64Image}`;

          // Also persist blob to IndexedDB for instant offline/browser load
          try {
            const bytes = base64ToUint8Array(result.base64Image);
            const blob = new Blob([bytes.buffer as ArrayBuffer], { type: result.mimeType || 'image/jpeg' });
            const projectId = project.projectId || 'default';
            await saveMediaBlob(`thumb_${projectId}_${concept.id}`, blob);
          } catch (storageErr) {
            console.warn('[ThumbnailStudio] Blob persistence warning:', storageErr);
          }
        }
      } catch (clientErr) {
        console.warn('[ThumbnailStudio] Direct generation failed, attempting API route fallback:', clientErr);
        // Fallback: try server route with apiKey forwarded
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: concept.visualPrompt.trim(),
            aspectRatio: isVertical ? '9:16' : '16:9',
            stylePrompt: stylePreset?.stylePrompt,
            negativePrompt: stylePreset?.negativePrompt,
            apiKey,
            model: chosenModel,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          imageUrl = data.imageUrl || data.url || data.base64Image;
        } else {
          throw clientErr;
        }
      }

      if (!imageUrl) {
        throw new Error('No image returned from generation engine');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('credits_updated'));
      }

      const updatedConcepts = (packaging?.thumbnailConcepts || []).map((c) =>
        c.id === concept.id ? { ...c, imageUrl } : c
      );

      const updatedPackaging: YouTubePackagingData = {
        ...(packaging as YouTubePackagingData),
        thumbnailConcepts: updatedConcepts,
        selectedThumbnailUrl: imageUrl,
      };

      const updated: ProjectManifest = {
        ...project,
        youtubePackaging: updatedPackaging,
      };

      // In-place replacement: switch out of edit mode so the generated thumbnail replaces the input box!
      setConceptEditMode((prev) => ({ ...prev, [concept.id]: false }));

      await saveProject(updated);
      onUpdateProject(updated);
      showToast('✓ Thumbnail generated successfully!');
    } catch (err: any) {
      console.error('Failed to generate thumbnail:', err);
      grantUserCredits(1, 'Refund: YouTube Thumbnail generation failed');
      showToast(`Thumbnail generation failed: ${err.message}`);
    } finally {
      setGeneratingThumbId(null);
    }
  };

  const handleUpdateBadge = async (
    conceptId: string,
    badgeText: string,
    color: 'yellow' | 'red' | 'white' | 'cyan' = 'yellow',
    position: 'top-left' | 'top-right' | 'bottom-left' | 'center' = 'top-left'
  ) => {
    if (!packaging?.thumbnailConcepts) return;
    const updatedConcepts = packaging.thumbnailConcepts.map((c) =>
      c.id === conceptId
        ? {
            ...c,
            customBadgeText: badgeText,
            badgeColor: color,
            badgePosition: position,
          }
        : c
    );
    const updatedPackaging: YouTubePackagingData = {
      ...packaging,
      thumbnailConcepts: updatedConcepts,
    };
    const updated: ProjectManifest = {
      ...project,
      youtubePackaging: updatedPackaging,
    };
    await saveProject(updated);
    onUpdateProject(updated);
    showToast('Thumbnail text overlay badge updated');
  };

  const handleDownloadThumbnail = (concept: ThumbnailConcept) => {
    const imageUrl = concept.imageUrl || activeThumbnail;
    if (!imageUrl) {
      showToast('No generated image to download');
      return;
    }
    const cleanTitle = (project.title || 'youtube_thumbnail').replace(/[^a-zA-Z0-9_-]/g, '_');
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${cleanTitle}_1280x720.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded High-Res Thumbnail (1280x720)');
  };

  const handleCopyMasterLaunchPack = () => {
    if (!packaging) return;
    const activeTitle = selectedTitle;
    const chaptersText = (packaging.chapters || []).map((c) => `${c.time} ${c.title}`).join('\n');
    const tagsCsv = (packaging.tags || []).join(', ');
    const hashtagsStr = (packaging.hashtags || []).join(' ');

    const fullPack = `=== YOUTUBE VIDEO TITLE ===
${activeTitle}

=== VIDEO DESCRIPTION ===
${packaging.description}

=== TIMESTAMPS / CHAPTERS ===
${chaptersText}

=== TAGS (CSV) ===
${tagsCsv}

=== HASHTAGS ===
${hashtagsStr}`;

    navigator.clipboard.writeText(fullPack);
    setCopiedKey('master_launch_pack');
    setTimeout(() => setCopiedKey(null), 3000);
    showToast('✨ Copied Complete YouTube Launch Pack to clipboard!');
  };

  const selectedTitle = packaging?.titles?.[packaging.selectedTitleIndex ?? 0]?.title || project.title;
  const activeThumbnail = packaging?.selectedThumbnailUrl || project.scenes?.[0]?.imageUrl || '';
  const activeConcept =
    packaging?.thumbnailConcepts?.find((c) => c.id === activeConceptId) ||
    packaging?.thumbnailConcepts?.[0] ||
    null;

  // Duration formatted (e.g. 02:15)
  const durationStr = useMemo(() => {
    const totalSeconds = Math.round((project.totalDurationMs || 60000) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, [project.totalDurationMs]);

  // Script stats
  const scriptWordCount = useMemo(() => {
    return voiceScript.trim() ? voiceScript.trim().split(/\s+/).length : 0;
  }, [voiceScript]);

  const scriptCharCount = voiceScript.length;

  return (
    <LaunchKitContext.Provider
      value={{
        project,
        packaging,
        onUpdateProject,
        showToast,
        userCredits,
        voiceScript,
        setVoiceScript,
        isScriptSaved,
        handleSaveScriptOnly,
        scriptWordCount,
        scriptCharCount,
        customFocus,
        setCustomFocus,
        stylePreset,
        isGenerating,
        errorMessage,
        handleGeneratePackaging,
        copiedKey,
        handleCopy,
        handleCopyMasterLaunchPack,
        competitorSearchInput,
        setCompetitorSearchInput,
        isSearchingCompetitors,
        handleSearchCompetitors,
        standoutMode,
        setStandoutMode,
        selectedTitle,
        handleSelectTitle,
        mockupViewMode,
        setMockupViewMode,
        activeThumbnail,
        activeConceptId,
        setActiveConceptId,
        activeConcept,
        conceptEditMode,
        setConceptEditMode,
        generatingThumbId,
        enhancingThumbId,
        handleUpdateConceptPrompt,
        handleUpdateConceptText,
        handleResetConceptPrompt,
        handleEnhanceConceptPrompt,
        handleAddCustomConcept,
        handleDeleteConcept,
        handleGenerateThumbnail,
        handleUpdateBadge,
        handleDownloadThumbnail,
        isVertical,
        durationStr,
      }}
    >
      {children}
    </LaunchKitContext.Provider>
  );
}
