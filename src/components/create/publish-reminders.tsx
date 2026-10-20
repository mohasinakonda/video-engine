'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, Loader2, X } from 'lucide-react';
import type { Upload } from '@/lib/youtube/create/publish';

interface Reminder {
  projectId: string;
  projectTitle: string;
  video: Upload;
}

const LAST_CHECK = 'create:publish-reminders:last';
const DISMISSED = 'create:publish-reminders:dismissed';
const HOUR = 3_600_000;

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: the banner may just show again
  }
};
const dismissed = (): string[] => {
  try {
    return JSON.parse(read(DISMISSED) || '[]');
  } catch {
    return [];
  }
};

/**
 * "New video found: is it for this project?" Checks the channel's recent uploads at most once
 * an hour while a project is in production. Nothing is linked without the creator's yes.
 */
export function PublishReminders({ hasWaiting, onLinked }: { hasWaiting: boolean; onLinked: () => void }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (!hasWaiting) return;
    const last = Number(read(LAST_CHECK) || 0);
    if (Date.now() - last < HOUR) return;
    write(LAST_CHECK, String(Date.now()));
    fetch('/api/create/publish-reminders')
      .then((r) => (r.ok ? r.json() : { reminders: [] }))
      .then((d: { reminders: Reminder[] }) => {
        const skip = new Set(dismissed());
        setReminders(d.reminders.filter((r) => !skip.has(`${r.projectId}:${r.video.videoId}`)));
      })
      .catch(() => undefined);
  }, [hasWaiting]);

  const dismiss = (r: Reminder) => {
    write(DISMISSED, JSON.stringify([...dismissed(), `${r.projectId}:${r.video.videoId}`].slice(-50)));
    setReminders((list) => list.filter((x) => x !== r));
  };

  const confirm = async (r: Reminder) => {
    setLinking(r.video.videoId);
    const res = await fetch(`/api/create/projects/${r.projectId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video: r.video.videoId, method: 'suggested' }),
    });
    setLinking(null);
    if (res.ok) {
      setReminders((list) => list.filter((x) => x.projectId !== r.projectId && x.video.videoId !== r.video.videoId));
      onLinked();
    } else {
      dismiss(r);
    }
  };

  if (!reminders.length) return null;
  return (
    <div className="space-y-2">
      {reminders.map((r) => (
        <div key={`${r.projectId}:${r.video.videoId}`} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-sky-500/30 bg-sky-500/10">
          <Bell size={18} className="text-sky-300 shrink-0" />
          <p className="flex-1 text-base text-sky-50">
            New video <span className="font-semibold">“{r.video.title}”</span> found on your channel. Is it for <span className="font-semibold">“{r.projectTitle}”</span>?
          </p>
          <div className="flex gap-2 shrink-0">
            <button type="button" className="btn-primary btn-sm" disabled={!!linking} onClick={() => confirm(r)}>
              {linking === r.video.videoId ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Yes, link it
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => dismiss(r)} aria-label="Not this one">
              <X size={14} />
              No
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
