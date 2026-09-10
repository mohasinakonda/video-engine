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

  // Extract project ID from storyboard route for context nav
  const storyboardMatch = pathname.startsWith('/storyboard');
  const projectPageMatch = pathname.startsWith('/project/new');

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-bg-surface border-r border-bg-border min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-purple-light flex items-center justify-center glow-purple">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-700 text-white leading-tight font-bold">AI Video</p>
            <p className="text-[10px] text-slate-500 leading-tight">Studio Desktop</p>
          </div>
        </div>
      </div>

      {/* New Project CTA */}
      <div className="px-3 pt-4">
        <Link
          href="/project/new"
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg
                     bg-gradient-to-r from-accent-purple/20 to-accent-cyan/10
                     border border-accent-purple/30 text-sm font-medium text-white
                     hover:from-accent-purple/30 hover:border-accent-purple/50
                     transition-all duration-200 group"
        >
          <PlusCircle size={15} className="text-accent-purple-light group-hover:scale-110 transition-transform" />
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
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
                          transition-all duration-150 group
                          ${isActive
                            ? 'bg-accent-purple/20 text-white border border-accent-purple/30'
                            : 'text-slate-400 hover:text-white hover:bg-bg-elevated'
                          }`}
            >
              <Icon
                size={15}
                className={isActive ? 'text-accent-purple-light' : 'text-slate-500 group-hover:text-slate-300'}
              />
              {label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-purple-light" />
              )}
            </Link>
          );
        })}

        {/* Contextual: Phase 2 Storyboard link when in a project */}
        {(storyboardMatch || projectPageMatch) && (
          <div className="pt-3">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3 pb-1.5">
              Current Project
            </p>
            {projectPageMatch && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-accent-purple-light bg-accent-purple/10 border border-accent-purple/20">
                <Mic2 size={13} className="text-accent-purple-light" />
                Phase 1 · Audio
              </div>
            )}
            {storyboardMatch && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/30 border border-cyan-800/30">
                <Film size={13} className="text-cyan-400" />
                Phase 2 · Storyboard
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-bg-border">
        <p className="text-[10px] text-slate-600">Phase 2 · BYOK</p>
      </div>
    </aside>
  );
}
