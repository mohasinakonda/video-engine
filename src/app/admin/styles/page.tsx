'use client';

import React, { useState } from 'react';
import { Palette, CheckCircle2, Loader2 } from 'lucide-react';
import type { BaseStylePreset } from '@/types';
import { saveAdminArtStyle } from '@/lib/store';
import { useAdminStyles } from './hooks/use-admin-styles';
import { StyleHeader } from './components/style-header';
import { StyleMetrics } from './components/style-metrics';
import { StyleFilters } from './components/style-filters';
import { StyleCard } from './components/style-card';
import { StyleEditModal } from './components/style-edit-modal';

export default function AdminStylesPage() {
  const {
    styles,
    setStyles,
    loading,
    isLiveSupabase,
    activeFamily,
    setActiveFamily,
    searchQuery,
    setSearchQuery,
    toastMessage,
    showToast,
    copiedId,
    seeding,
    handleSeedDefaults,
    handleToggleActive,
    handleDelete,
    handleCopyPrompt,
    filteredStyles,
    totalActive,
    totalInactive,
  } = useAdminStyles();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStyle, setEditingStyle] = useState<BaseStylePreset | null>(null);

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingStyle(null);
    setIsModalOpen(true);
  };

  const openEditModal = (s: BaseStylePreset) => {
    setIsEditing(true);
    setEditingStyle(s);
    setIsModalOpen(true);
  };

  const handleFastUpdate = (updatedStyle: BaseStylePreset) => {
    saveAdminArtStyle(updatedStyle);
    setStyles((prev) => {
      const idx = prev.findIndex((s) => s.id === updatedStyle.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedStyle;
        return next;
      }
      return [updatedStyle, ...prev];
    });
  };

  const handleSaveStyle = async (updatedStyle: BaseStylePreset) => {
    // 1. Immediately persist to localStorage
    handleFastUpdate(updatedStyle);

    // 2. Persist to server (file store + Supabase)
    try {
      const res = await fetch('/api/admin/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', style: updatedStyle }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Style saved successfully!');
      } else {
        showToast(`Saved locally: ${data.message || 'Server sync pending'}`);
      }
    } catch {
      showToast('Saved locally in browser and active session.');
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900 border border-emerald-500/40 text-emerald-400 shadow-2xl animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <StyleHeader
          isLiveSupabase={isLiveSupabase}
          seeding={seeding}
          onSeedDefaults={handleSeedDefaults}
          onOpenCreateModal={openCreateModal}
        />

        {/* Analytics & Metrics Cards */}
        <StyleMetrics
          totalCount={styles.length}
          totalActive={totalActive}
          totalInactive={totalInactive}
        />

        {/* Filter and Search Bar */}
        <StyleFilters
          activeFamily={activeFamily}
          onSelectFamily={setActiveFamily}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Styles Cards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
            <Loader2 size={28} className="animate-spin text-purple-400" />
            <p className="text-xs">Loading Art Styles catalog...</p>
          </div>
        ) : filteredStyles.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800">
            <Palette size={32} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-semibold text-zinc-300">No art styles found</p>
            <p className="text-xs text-zinc-500 mt-1">Try changing filters or sync default catalog</p>
            <button
              onClick={handleSeedDefaults}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400"
            >
              Sync Default 30+ Catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredStyles.map((s) => (
              <StyleCard
                key={s.id}
                style={s}
                copiedId={copiedId}
                onToggleActive={handleToggleActive}
                onOpenEdit={openEditModal}
                onDelete={handleDelete}
                onCopyPrompt={handleCopyPrompt}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Style Modal */}
      <StyleEditModal
        isOpen={isModalOpen}
        isEditing={isEditing}
        initialStyle={editingStyle}
        defaultSortOrder={styles.length * 10 + 10}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStyle}
        onFastUpdate={handleFastUpdate}
        showToast={showToast}
      />
    </div>
  );
}
