'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { BaseStylePreset } from '@/types';
import { getAdminArtStyles, saveAdminArtStyle, deleteAdminArtStyle } from '@/lib/store';

export function useAdminStyles() {
  const [styles, setStyles] = useState<BaseStylePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [activeFamily, setActiveFamily] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadStyles = useCallback(async () => {
    setLoading(true);
    try {
      let apiStyles: BaseStylePreset[] = [];
      const res = await fetch('/api/admin/styles');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.styles) {
          apiStyles = data.styles;
          setIsLiveSupabase(Boolean(data.isLiveSupabase));
        }
      } else {
        const pubRes = await fetch('/api/styles');
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          if (pubData.styles) {
            apiStyles = pubData.styles;
          }
        }
      }

      // Merge with localStorage overrides
      const localStyles = getAdminArtStyles();
      const localMap = new Map(localStyles.map((s) => [s.id, s]));
      const merged = apiStyles.map((s) => localMap.get(s.id) || s);
      const apiIds = new Set(apiStyles.map((s) => s.id));
      const extraLocal = localStyles.filter((s) => !apiIds.has(s.id));

      setStyles([...merged, ...extraLocal]);
    } catch (err) {
      console.error('Failed to load styles:', err);
      const localStyles = getAdminArtStyles();
      if (localStyles.length > 0) {
        setStyles(localStyles);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStyles();
  }, [loadStyles]);

  const handleSeedDefaults = async () => {
    if (!confirm('This will sync and seed all 30+ default sub-styles into the database. Continue?')) {
      return;
    }
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Styles seeded successfully!');
        loadStyles();
      } else {
        showToast(`Seeding notice: ${data.message || 'Database not ready'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to seed'}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // Optimistic UI update
    setStyles((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: nextStatus } : s))
    );

    const existing = styles.find((s) => s.id === id);
    if (existing) {
      saveAdminArtStyle({ ...existing, isActive: nextStatus });
    }

    try {
      const res = await fetch('/api/admin/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id, isActive: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Style ${nextStatus ? 'enabled' : 'disabled'}.`);
      }
    } catch (err) {
      console.warn('Failed to toggle remotely:', err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete style "${name}"?`)) return;

    deleteAdminArtStyle(id);
    setStyles((prev) => prev.filter((s) => s.id !== id));
    try {
      const res = await fetch('/api/admin/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Style "${name}" deleted.`);
      }
    } catch (err) {
      console.warn('Failed to delete remotely:', err);
    }
  };

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter Styles
  const filteredStyles = useMemo(() => {
    return styles.filter((s) => {
      const matchesFamily = activeFamily === 'all' || s.familyId === activeFamily;
      const matchesSearch =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tag && s.tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.stylePrompt.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFamily && matchesSearch;
    });
  }, [styles, activeFamily, searchQuery]);

  const totalActive = useMemo(
    () => styles.filter((s) => s.isActive !== false).length,
    [styles]
  );
  const totalInactive = useMemo(
    () => styles.length - totalActive,
    [styles, totalActive]
  );

  return {
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
    loadStyles,
    handleSeedDefaults,
    handleToggleActive,
    handleDelete,
    handleCopyPrompt,
    filteredStyles,
    totalActive,
    totalInactive,
  };
}
