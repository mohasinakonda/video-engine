import React from 'react';
import {
  Check,
  Play,
  ChevronDown,
} from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="py-24 px-6 border-b border-[#2e2e2e] bg-[#fbfbfb] text-zinc-900">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <div className="space-y-3">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            HOW IT WORKS
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight leading-[1.1]">
            Your script is <br />
            the starting point.
          </h2>
        </div>

        {/* Stepper Bar (Horizontal with connecting lines) */}
        <div className="hidden lg:grid grid-cols-6 gap-2 items-center pt-2">
          {[
            { num: '01', label: 'Script' },
            { num: '02', label: 'Analyze' },
            { num: '03', label: 'Scenes' },
            { num: '04', label: 'Visuals' },
            { num: '05', label: 'Narration' },
            { num: '06', label: 'Video' },
          ].map((step, idx) => (
            <div key={step.num} className="flex items-center">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-zinc-400 font-semibold">{step.num}</span>
                <span className="text-sm font-bold text-zinc-900 mt-0.5">{step.label}</span>
              </div>
              {idx < 5 && (
                <div className="flex-1 h-[1px] bg-zinc-200 mx-3 sm:mx-4" />
              )}
            </div>
          ))}
        </div>

        {/* 6 Visual Preview Cards + Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">

          {/* ── Column 1: 1. Add your script ── */}
          <div className="flex flex-col space-y-3.5">
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-400 font-bold">01</span>
              <span className="text-xs font-bold text-zinc-900">Script</span>
            </div>

            {/* Card 1: Your Script */}
            <div className="bg-[#121215] border border-[#2e2e2e] rounded-2xl p-3.5 aspect-[4/3.4] flex flex-col justify-between shadow-sm">
              <div className="space-y-2">
                <span className="text-[11px] font-medium text-zinc-300 block">Your script</span>
                <div className="p-2.5 rounded-lg bg-[#18181c] border border-[#2e2e2e] text-[10px] sm:text-[11px] font-mono text-zinc-300 leading-relaxed min-h-[58px]">
                  &ldquo;In 1969, humans took their first steps on the Moon...&rdquo;
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <span className="text-[9px] font-mono text-zinc-500">124/2000</span>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-950">1. Add your script</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Paste your script and let the AI understand your story.
              </p>
            </div>
          </div>

          {/* ── Column 2: 2. AI analyzes ── */}
          <div className="flex flex-col space-y-3.5">
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-400 font-bold">02</span>
              <span className="text-xs font-bold text-zinc-900">Analyze</span>
            </div>

            {/* Card 2: AI Analysis */}
            <div className="bg-[#121215] border border-[#2e2e2e] rounded-2xl p-3.5 aspect-[4/3.4] flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-300">AI Analysis</span>
                <span className="w-4 h-4 rounded-full bg-zinc-800 border border-[#2e2e2e] flex items-center justify-center text-emerald-400">
                  <Check size={10} />
                </span>
              </div>

              <div className="p-2 rounded-lg bg-[#18181c] border border-[#2e2e2e] space-y-1 text-[10px] font-mono text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <Play size={8} className="text-zinc-500 fill-zinc-500" />
                  <span>Key topics</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Play size={8} className="text-zinc-500 fill-zinc-500" />
                  <span>Scene breakdown</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Play size={8} className="text-zinc-500 fill-zinc-500" />
                  <span>Visual suggestions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Play size={8} className="text-zinc-500 fill-zinc-500" />
                  <span>Estimated duration</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 px-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[7px]">✓</span>
                <span>4/4 Analyzed</span>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-950">2. AI analyzes</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                It identifies key points, structure and creates a scene plan.
              </p>
            </div>
          </div>

          {/* ── Column 3: 3. Scene planning ── */}
          <div className="flex flex-col space-y-3.5">
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-400 font-bold">03</span>
              <span className="text-xs font-bold text-zinc-900">Scenes</span>
            </div>

            {/* Card 3: Scene Plan */}
            <div className="bg-[#121215] border border-[#2e2e2e] rounded-2xl p-3.5 aspect-[4/3.4] flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-zinc-300">Scene Plan</span>

              <div className="p-2 rounded-lg bg-[#18181c] border border-[#2e2e2e] space-y-1.5 text-[9px] font-mono">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="truncate pr-1"><strong className="text-zinc-400">01</strong> The journey begins</span>
                  <span className="text-zinc-500 shrink-0">0:00 - 0:07</span>
                </div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="truncate pr-1"><strong className="text-zinc-400">02</strong> The mission</span>
                  <span className="text-zinc-500 shrink-0">0:07 - 0:15</span>
                </div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="truncate pr-1"><strong className="text-zinc-400">03</strong> A new perspective</span>
                  <span className="text-zinc-500 shrink-0">0:15 - 0:24</span>
                </div>
              </div>

              <div className="flex justify-end">
                <span className="text-[9px] font-mono text-emerald-400">3 Scenes Ready</span>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-950">3. Scene planning</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Turns your narration into structured scenes with timing.
              </p>
            </div>
          </div>

          {/* ── Column 4: 4. Visual generation ── */}
          <div className="flex flex-col space-y-3.5">
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-400 font-bold">04</span>
              <span className="text-xs font-bold text-zinc-900">Visuals</span>
            </div>

            {/* Card 4: Visual Generation */}
            <div className="bg-[#121215] border border-[#2e2e2e] rounded-2xl overflow-hidden aspect-[4/3.4] relative shadow-sm group">
              <img
                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80"
                alt="Visual generation astronaut"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-mono text-zinc-200 border border-white/10">
                Flux 8K
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-950">4. Visual generation</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Creates relevant images for each scene using AI.
              </p>
            </div>
          </div>

          {/* ── Column 5: 5. Narration ── */}
          <div className="flex flex-col space-y-3.5">
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-400 font-bold">05</span>
              <span className="text-xs font-bold text-zinc-900">Narration</span>
            </div>

            {/* Card 5: Narration Voice */}
            <div className="bg-[#121215] border border-[#2e2e2e] rounded-2xl p-3.5 aspect-[4/3.4] flex flex-col justify-between shadow-sm">
              {/* Waveform Graphic */}
              <div className="h-9 flex items-center justify-between gap-1 px-1">
                {[30, 60, 40, 90, 100, 70, 45, 80, 95, 60, 40, 85, 50, 30].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="w-1 bg-zinc-300 rounded-full inline-block"
                  />
                ))}
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-mono text-zinc-400 block">AI Voice</span>
                <div className="p-1.5 px-2.5 rounded-lg bg-[#18181c] border border-[#2e2e2e] text-[10px] font-mono text-zinc-200 flex items-center justify-between">
                  <span>Professional</span>
                  <ChevronDown size={11} className="text-zinc-400" />
                </div>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-950">5. Narration</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Generates natural voice and syncs it with the scenes.
              </p>
            </div>
          </div>

          {/* ── Column 6: 6. Final video ── */}
          <div className="flex flex-col space-y-3.5">
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-400 font-bold">06</span>
              <span className="text-xs font-bold text-zinc-900">Video</span>
            </div>

            {/* Card 6: Final Video Player with Rocket */}
            <div className="bg-[#121215] border border-[#2e2e2e] rounded-2xl overflow-hidden aspect-[4/3.4] relative shadow-sm flex flex-col justify-end group">
              <img
                src="https://images.unsplash.com/photo-1517976487507-598f11183307?auto=format&fit=crop&w=600&q=80"
                alt="Rocket launch final video"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* Overlay Player Bar */}
              <div className="relative z-10 p-2">
                <div className="p-1.5 px-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-between text-[9px] font-mono text-zinc-300">
                  <Play size={9} className="fill-white text-white" />
                  <div className="flex-1 h-1 bg-zinc-700/80 rounded-full mx-2 overflow-hidden">
                    <div className="w-1/2 h-full bg-white rounded-full" />
                  </div>
                  <ChevronDown size={10} className="text-zinc-400" />
                </div>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-950">6. Final video</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                All elements come together into a polished, ready-to-share video.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
