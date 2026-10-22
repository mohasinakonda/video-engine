import React from 'react';
import { Clapperboard, Compass, PenLine, Search, Stethoscope } from 'lucide-react';

const STEPS = [
  { icon: Stethoscope, name: 'Channel Doctor', line: 'Find out why your channel isn’t growing.' },
  { icon: Compass, name: 'Discover', line: 'See what your audience wants next.' },
  { icon: PenLine, name: 'Create', line: 'Get the brief, script, title and thumbnail.' },
  { icon: Clapperboard, name: 'Make the video', line: 'Turn the script into a finished video.' },
  { icon: Search, name: 'Analyze', line: 'Learn why a video worked, then go again.' },
];

/** The five tools as one loop: the story the rest of the page tells. */
export const GrowthLoopSection: React.FC = () => {
  return (
    <section id="growth-loop" className="py-20 sm:py-24 px-6 border-b border-[#E5E0D8] bg-[#F4F0EA] text-zinc-900">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="max-w-2xl space-y-4">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">ONE TOOL FOR THE WHOLE JOB</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Stop guessing what to post. <br className="hidden sm:block" />
            <span className="text-zinc-500 font-medium">Know it, then make it.</span>
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
            Most channels stall because the next video is a guess. Rendoza reads your channel and your market, tells you what to make, and helps you make it.
          </p>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.name} className="relative rounded-2xl bg-white border border-[#E5E0D8] p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-center text-[#E05A30]">
                    <Icon size={19} strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">0{i + 1}</span>
                </div>
                <h3 className="text-sm font-bold text-zinc-950">{step.name}</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">{step.line}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
