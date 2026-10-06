'use client';

import { useState, useRef, useEffect } from 'react';
import { Video, AlertTriangle } from 'lucide-react';
import type { SceneItem, ShotType } from '@/types';
import { generateBRollPrompt } from '@/lib/pollinations';

import {
  SHOT_TYPE_CONFIG,
  MOTION_LABELS,
  statusClass,
  statusLabel,
} from './scene-card/scene-card-constants';
import { useScenePrompt } from './scene-card/use-scene-prompt';
import SceneCardMedia from './scene-card/scene-card-media';
import SceneCardHeader from './scene-card/scene-card-header';
import SceneCardActions from './scene-card/scene-card-actions';
import SceneCardNarration from './scene-card/scene-card-narration';
import ScenePromptEditorOverlay from './scene-card/scene-prompt-editor-overlay';
import SceneStudioModal from './scene-card/scene-studio-modal';

// Re-export constants and helpers for backward compatibility
export { SHOT_TYPE_CONFIG, MOTION_LABELS, statusClass, statusLabel };

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SceneCardProps {
  scene: SceneItem;
  projectId?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  stylePrompt?: string;
  onRegenerate: (scene: SceneItem, newPrompt?: string) => void;
  onUpload: (scene: SceneItem, file: File) => void;
  onUpdateDuration?: (sceneId: number, deltaSec: number) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SceneCard({
  scene,
  projectId,
  aspectRatio = '16:9',
  stylePrompt,
  onRegenerate,
  onUpload,
  onUpdateDuration,
  disabled,
}: SceneCardProps) {
  const [hovering, setHovering] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(scene.imageUrl);
  const [isSubmittingRegenerate, setIsSubmittingRegenerate] = useState(false);
  const [, setIsSwitchingBRoll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentSrc(scene.imageUrl);
    setImgError(false);
  }, [scene.imageUrl]);

  const {
    promptDraft,
    setPromptDraft,
    isEnhancingPrompt,
    handleEnhancePrompt,
    handleAppendModifier,
  } = useScenePrompt({
    initialPrompt: scene.visualPrompt,
    fallbackText: scene.narrationLine,
    shotType: scene.shotType,
    stylePrompt,
  });

  const isGenerating =
    scene.status === 'GENERATING_IMAGE' || scene.status === 'GENERATING_MOTION';

  const duration = (scene.audioEndSec - scene.audioStartSec).toFixed(1);
  const timeRange = `${scene.audioStartSec.toFixed(1)}s – ${scene.audioEndSec.toFixed(1)}s`;

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(scene, file);
      e.target.value = '';
    }
  }

  function handleRegenerate() {
    if (disabled || isGenerating || isSubmittingRegenerate) return;
    setIsSubmittingRegenerate(true);
    setTimeout(() => setIsSubmittingRegenerate(false), 800);

    if (editingPrompt) {
      setEditingPrompt(false);
      onRegenerate({ ...scene, visualPrompt: promptDraft }, promptDraft);
    } else {
      onRegenerate(scene);
    }
  }

  async function handleSwitchShotType(targetType: ShotType) {
    setMoreMenuOpen(false);
    setIsSwitchingBRoll(true);
    try {
      const context = scene.narrationLine || scene.visualPrompt;
      const res = await generateBRollPrompt(context, targetType, undefined, stylePrompt);
      const updatedScene: SceneItem = {
        ...scene,
        shotType: targetType,
        bRollFocus: res.b_roll_focus,
        visualPrompt: res.visual_prompt,
        fullPrompt: stylePrompt ? `${res.visual_prompt}. ${stylePrompt}` : res.visual_prompt,
      };
      setPromptDraft(res.visual_prompt);
      onRegenerate(updatedScene, res.visual_prompt);
    } catch (err) {
      console.error('Failed to switch B-Roll perspective:', err);
    } finally {
      setIsSwitchingBRoll(false);
    }
  }

  return (
    <div
      className={`relative group rounded-2xl border transition-all duration-300 shadow-md hover:shadow-2xl ${
        moreMenuOpen ? 'z-40 overflow-visible' : 'overflow-hidden'
      } ${
        aspectRatio === '9:16'
          ? 'aspect-[9/16]'
          : aspectRatio === '1:1'
          ? 'aspect-square'
          : 'aspect-video'
      } ${hovering ? 'border-zinc-500/70' : 'border-white/10'} ${
        isGenerating ? 'ring-2 ring-emerald-500/50 animate-pulse' : ''
      }`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setMoreMenuOpen(false);
        if (editingPrompt) setEditingPrompt(false);
      }}
      style={{ background: 'var(--bg-surface)' }}
    >
      {/* ── 1. Full-bleed Artwork Canvas ────────────────────────────────────────── */}
      <SceneCardMedia
        scene={scene}
        projectId={projectId}
        currentSrc={currentSrc}
        imgError={imgError}
        isGenerating={isGenerating}
        editingPrompt={editingPrompt}
        onOpenPreview={() => setPreviewOpen(true)}
        onRegenerate={handleRegenerate}
        onRecoverSrc={setCurrentSrc}
        onSetImgError={setImgError}
      />

      {/* ── 2. Top-Left: Scene # & Duration Stepper ─────────────────────────────── */}
      <SceneCardHeader
        sceneId={scene.sceneId}
        duration={duration}
        visualType={scene.visualType}
        cameraMotion={scene.cameraMotion}
        onUpdateDuration={onUpdateDuration}
        disabled={disabled}
      />

      {/* ── 3. Top-Right: Quick Actions Capsule & Dropdown ──────────────────────── */}
      <SceneCardActions
        scene={scene}
        currentSrc={currentSrc}
        imgError={imgError}
        isGenerating={isGenerating}
        disabled={disabled}
        hovering={hovering}
        moreMenuOpen={moreMenuOpen}
        isSubmittingRegenerate={isSubmittingRegenerate}
        onSetMoreMenuOpen={setMoreMenuOpen}
        onRegenerate={handleRegenerate}
        onOpenPreview={() => setPreviewOpen(true)}
        onUploadClick={handleUploadClick}
        onSwitchShotType={handleSwitchShotType}
      />

      {/* ── 4. Bottom: On-Hover Cinematic Caption Bar ─────────────────────────── */}
      <SceneCardNarration
        narrationText={scene.narrationLine || scene.visualPrompt}
        visible={hovering && !editingPrompt && !moreMenuOpen}
        visualType={scene.visualType}
        shotType={scene.shotType}
        motionReady={scene.status === 'MOTION_READY'}
      />

      {/* ── 5. In-Card Prompt Editor Overlay ─────────────────────────────────────── */}
      {editingPrompt && (
        <ScenePromptEditorOverlay
          sceneId={scene.sceneId}
          promptDraft={promptDraft}
          setPromptDraft={setPromptDraft}
          isEnhancingPrompt={isEnhancingPrompt}
          isGenerating={isGenerating}
          isSubmittingRegenerate={isSubmittingRegenerate}
          disabled={disabled}
          onEnhancePrompt={handleEnhancePrompt}
          onAppendModifier={handleAppendModifier}
          onRegenerate={handleRegenerate}
          onClose={() => setEditingPrompt(false)}
        />
      )}

      {/* ── 6. Motion Clip Status Pill (Idle micro-badge) ────────────────────── */}
      {scene.status === 'MOTION_READY' && !hovering && !moreMenuOpen && !editingPrompt && (
        <div
          className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-300 shadow-sm transition-all duration-200 select-none"
          title="Motion clip rendered and ready"
        >
          <Video size={9} className="text-emerald-400" />
          <span className="text-[9px] font-mono font-medium">Motion</span>
        </div>
      )}

      {/* Error notification if failed */}
      {scene.error && scene.status === 'FAILED' && (
        <div className="absolute inset-x-3 bottom-3 z-20 flex items-start gap-1.5 p-2 rounded-xl bg-red-950/90 border border-red-800/60 shadow-lg backdrop-blur-md animate-fade-in">
          <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-200 line-clamp-2 leading-tight flex-1">
            {scene.error}
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Lightbox Full Preview & Creative Studio Modal */}
      {previewOpen && (currentSrc || scene.imageUrl) && (
        <SceneStudioModal
          scene={scene}
          currentSrc={currentSrc}
          aspectRatio={aspectRatio}
          timeRange={timeRange}
          duration={duration}
          promptDraft={promptDraft}
          setPromptDraft={setPromptDraft}
          isEnhancingPrompt={isEnhancingPrompt}
          isGenerating={isGenerating}
          isSubmittingRegenerate={isSubmittingRegenerate}
          disabled={disabled}
          onClose={() => setPreviewOpen(false)}
          onUploadClick={handleUploadClick}
          onEnhancePrompt={handleEnhancePrompt}
          onAppendModifier={handleAppendModifier}
          onRegenerate={() => {
            onRegenerate({ ...scene, visualPrompt: promptDraft }, promptDraft);
          }}
        />
      )}
    </div>
  );
}
