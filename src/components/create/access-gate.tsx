import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { CreateConfig } from './types';

/** Shows loading, no-access or the admin-preview note; renders children only when Create is usable. */
export function AccessGate({ config, error, children }: { config: CreateConfig | null; error: boolean; children: React.ReactNode }) {
  if (error) return <div className="card text-base text-zinc-300">Couldn’t load Create. Please refresh the page.</div>;
  if (!config)
    return (
      <div className="card flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-zinc-400" />
      </div>
    );
  if (!config.hasAccess)
    return (
      <div className="card space-y-3">
        {config.enabled ? (
          <>
            <p className="text-base text-zinc-200">Create is available on the {config.allowedPlans.map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(', ')} plans.</p>
            <Link href="/plan" className="btn-primary btn-sm w-fit">
              Upgrade plan
            </Link>
          </>
        ) : (
          <p className="text-base text-zinc-300">Create is coming soon.</p>
        )}
      </div>
    );
  return (
    <>
      {config.adminPreview && (
        <p className="text-sm text-amber-200 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          Admin preview: Create is switched off for users. Turn it on in Admin → Channel Doctor.
        </p>
      )}
      {children}
    </>
  );
}
