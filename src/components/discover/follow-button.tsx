'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { followChannel } from './follow-channel';

/** The "New" tag stays on "Add to competitors" buttons for two weeks after launch, so returning users notice them. */
const NEW_UNTIL = Date.parse('2026-11-10T00:00:00Z');

export function NewTag() {
  if (Date.now() >= NEW_UNTIL) return null;
  return <span className="px-1.5 py-px rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wide">New</span>;
}

/** A confirmation that leads to the list the channel was added to. */
function toastFollowed(channelTitle: string) {
  toast.success(
    <span>
      Added {channelTitle} to your competitors.{' '}
      <Link href="/discover?tab=competitors" className="font-semibold underline">
        See your competitors
      </Link>
    </span>,
    { duration: 6000 }
  );
}

/**
 * Add a channel to the competitors list (Discover), the same button wherever a channel appears. No
 * YouTube search is used. The parent owns `followed` so every row of the same channel updates.
 */
export function FollowButton({
  channelId,
  channelTitle,
  followed,
  onFollowed,
  compact = false,
  className = '',
}: {
  channelId: string;
  channelTitle: string;
  followed: boolean;
  onFollowed: (channelId: string) => void;
  /** Smaller, for tight cards. */
  compact?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const size = compact ? 12 : 14;

  if (followed) {
    return (
      <span className={`inline-flex items-center gap-1 text-zinc-400 ${compact ? 'text-xs' : 'text-sm'} ${className}`}>
        <Check size={size} className="text-emerald-400" />
        In your competitors
      </span>
    );
  }

  const follow = async () => {
    setBusy(true);
    const res = await followChannel(channelId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    onFollowed(channelId);
    toastFollowed(channelTitle);
  };

  return (
    <button
      type="button"
      onClick={follow}
      disabled={busy}
      title="Add to your competitors: its videos join your market research. No YouTube search needed."
      className={`btn-secondary btn-sm ${compact ? 'text-xs px-2 py-1' : ''} ${className}`}
    >
      {busy ? <Loader2 size={size} className="animate-spin" /> : <UserPlus size={size} />}
      Add to competitors
      <NewTag />
    </button>
  );
}

/** A page about one channel: the button keeps its own state. */
export function FollowOneChannel(props: { channelId: string; channelTitle: string; compact?: boolean; className?: string }) {
  const [followed, setFollowed] = useState(false);
  return <FollowButton {...props} followed={followed} onFollowed={() => setFollowed(true)} />;
}
