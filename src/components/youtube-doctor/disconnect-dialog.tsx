'use client';

import { useState } from 'react';
import { Loader2, Unplug, X } from 'lucide-react';

interface DisconnectDialogProps {
  channelTitle: string | null;
  onClose: () => void;
  /** Resolves with Google's revocation result, or throws on failure. */
  onConfirm: () => Promise<{ revokedAtGoogle: boolean }>;
}

/** Screen 8: explains what disconnecting does, then reports the honest outcome. */
export function DisconnectDialog({ channelTitle, onClose, onConfirm }: DisconnectDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ revokedAtGoogle: boolean } | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await onConfirm());
    } catch (err) {
      setError((err as Error).message || 'Could not disconnect. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="disconnect-title">
      <div className="modal-panel max-w-md p-6 space-y-4 relative">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-zinc-400 hover:text-white">
          <X size={18} />
        </button>

        {result ? (
          <>
            <h3 id="disconnect-title" className="text-lg font-bold text-white">YouTube disconnected</h3>
            <p className="text-base text-zinc-300">
              {result.revokedAtGoogle
                ? 'Our access was revoked at Google and the connection was removed from our app.'
                : 'The connection was removed from our app, but Google did not confirm the revocation.'}
            </p>
            {!result.revokedAtGoogle && (
              <p className="text-sm text-zinc-400">
                To be sure, remove the app at{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline"
                >
                  myaccount.google.com/permissions
                </a>
                .
              </p>
            )}
            <button type="button" onClick={onClose} className="btn-primary w-full">
              Done
            </button>
          </>
        ) : (
          <>
            <h3 id="disconnect-title" className="text-lg font-bold text-white">
              Disconnect {channelTitle || 'this channel'}?
            </h3>
            <ul className="text-base text-zinc-300 space-y-2 list-disc pl-5">
              <li>We remove our access to your channel at Google.</li>
              <li>We stop the daily report YouTube was preparing for us.</li>
              <li>We delete the saved connection, your saved competitors and the reports in this tab.</li>
            </ul>
            <p className="text-sm text-zinc-400">You can connect again any time.</p>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={busy}>
                Cancel
              </button>
              <button type="button" onClick={confirm} className="btn-danger flex-1" disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
