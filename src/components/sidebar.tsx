'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Video,
  Mic2,
  Settings,
  PlusCircle,
  Zap,
  Film,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Projects', icon: Video },
  { href: '/voice-studio', label: 'Voice Studio', icon: Mic2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];



export default function Sidebar() {
  const pathname = usePathname();

  // Extract project ID from routes for context nav
  const storyboardMatch = pathname.startsWith('/storyboard');
  const projectPageMatch = pathname.startsWith('/project/new');
  const exportMatch = pathname.startsWith('/export');

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-bg-base border-r border-bg-border min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-bold shadow-sm">
            <Zap size={16} className="text-zinc-950 fill-zinc-950" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">AI Video</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Studio Desktop</p>
          </div>
        </div>
      </div>

      {/* New Project CTA */}
      <div className="px-3 pt-4">
        <Link
          href="/project/new"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg
                     bg-white text-zinc-950 text-sm font-medium
                     hover:bg-zinc-200 transition-colors shadow-sm group"
        >
          <PlusCircle size={15} className="text-zinc-950 group-hover:scale-105 transition-transform" />
          New Project
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                          transition-colors duration-150 group
                          ${isActive
                            ? 'bg-zinc-800/90 text-white border border-zinc-700/60'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40'
                          }`}
            >
              <Icon
                size={15}
                className={isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}
              />
              {label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </Link>
          );
        })}

        {/* Contextual navigation when in a project */}
        {(storyboardMatch || projectPageMatch || exportMatch) && (
          <div className="pt-4 mt-2 border-t border-bg-border/60">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 pb-2">
              Current Project
            </p>
            {projectPageMatch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-850 border border-zinc-800">
                <Mic2 size={13} className="text-zinc-400" />
                Phase 1 · Audio
              </div>
            )}
            {storyboardMatch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-850 border border-zinc-800">
                <Film size={13} className="text-zinc-400" />
                Phase 2 · Storyboard
              </div>
            )}
            {exportMatch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-850 border border-zinc-800">
                <Video size={13} className="text-zinc-400" />
                Phase 3 · Final Export
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-bg-border">
        <p className="text-[10px] text-zinc-400">Phase 2 · BYOK</p>
      </div>
    </aside>
  );
}
