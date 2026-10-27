'use client';

import React from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Compass, PenLine, Search, Stethoscope } from 'lucide-react';
import { usePricingCatalog } from '@/hooks/use-pricing-catalog';
import { plansText } from '@/components/pricing/growth-tools-section';
import type { GrowthToolId } from '@/lib/pricing-catalog';

/** Marks the made-up numbers in the illustrations, so nobody reads them as real results. */
const ExampleBadge = () => (
  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F4F0EA] text-zinc-600 border border-[#E5E0D8]">Example</span>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl bg-white border border-[#E5E0D8] shadow-xl shadow-zinc-950/[0.04] p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-bold text-zinc-950">{title}</p>
      <ExampleBadge />
    </div>
    {children}
  </div>
);

function DoctorMock() {
  const rows = [
    { label: 'Click-through rate', value: '3.1%', note: 'your usual 4.8%', down: true },
    { label: 'Viewers still watching at 30s', value: '58%', note: 'about your usual', down: null },
    { label: 'Views from YouTube search', value: '+24%', note: 'last 28 days', down: false },
  ];
  return (
    <Card title="Channel diagnosis">
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8]">
            <span className="text-xs text-zinc-700">{r.label}</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-zinc-950">
              {r.down === true && <ArrowDownRight size={14} className="text-rose-500" />}
              {r.down === false && <ArrowUpRight size={14} className="text-emerald-600" />}
              {r.value}
              <span className="font-normal text-zinc-500">· {r.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="p-3 rounded-xl bg-[#FDEEE8] border border-[#F6D3C5] text-xs text-zinc-800 leading-relaxed">
        <strong className="text-[#C84C25]">Main problem:</strong> your thumbnails lose clicks. 6 of your last 10 videos got fewer clicks than your usual.
      </div>
    </Card>
  );
}

function DiscoverMock() {
  const ideas = [
    { topic: 'Why orcas don’t attack humans', score: 86, tags: ['Rising', 'Low competition'] },
    { topic: 'The deepest place in the ocean', score: 74, tags: ['Steady', 'Few Bangla videos'] },
    { topic: 'Animals that live over 200 years', score: 69, tags: ['Rising', 'Fits your channel'] },
  ];
  return (
    <Card title="Your next video ideas">
      <ul className="space-y-2">
        {ideas.map((idea) => (
          <li key={idea.topic} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8]">
            <span className="w-10 h-10 shrink-0 rounded-lg bg-zinc-950 text-white text-sm font-bold flex items-center justify-center tabular-nums">{idea.score}</span>
            <span className="min-w-0 space-y-1">
              <span className="block text-xs font-semibold text-zinc-950 truncate">{idea.topic}</span>
              <span className="flex flex-wrap gap-1">
                {idea.tags.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#E5E0D8] text-zinc-600">
                    {t}
                  </span>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-500">Scored from what your competitors’ videos did and what fits your channel.</p>
    </Card>
  );
}

function CreateMock() {
  const steps = ['Brief', 'Script', 'Title & thumbnail'];
  const titles = [
    { title: 'Why don’t orcas ever attack us?', kind: 'Question' },
    { title: 'The ocean’s top hunter has one strange rule', kind: 'Curiosity' },
  ];
  return (
    <Card title="Video plan">
      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <span key={s} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border ${i < 2 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-[#E5E0D8] text-zinc-700'}`}>
            {i < 2 && <Check size={12} />}
            {s}
          </span>
        ))}
      </div>
      <ul className="space-y-2">
        {titles.map((t) => (
          <li key={t.title} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8]">
            <span className="text-xs font-semibold text-zinc-950">{t.title}</span>
            <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded bg-white border border-[#E5E0D8] text-zinc-600">{t.kind}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-950 text-white">
        <span className="text-[10px] font-mono uppercase text-zinc-400">Thumbnail text</span>
        <span className="text-sm font-extrabold">কোনটা সত্যি?</span>
      </div>
    </Card>
  );
}

function AnalyzeMock() {
  const reasons = ['The title is a clear question, under 60 characters', 'The thumbnail has one subject and big, readable text', 'Viewers in the comments ask for a part 2'];
  return (
    <Card title="Why this video worked">
      <div className="flex items-end gap-2">
        <span className="text-3xl font-extrabold text-zinc-950 tabular-nums">3.4×</span>
        <span className="text-xs text-zinc-500 pb-1">its channel’s usual views</span>
      </div>
      <ul className="space-y-2">
        {reasons.map((r) => (
          <li key={r} className="flex gap-2 text-xs text-zinc-700">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            {r}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const TOOLS: { id: GrowthToolId; icon: typeof Compass; eyebrow: string; title: string; text: string; points: string[]; mock: React.FC }[] = [
  {
    id: 'doctor',
    icon: Stethoscope,
    eyebrow: 'Channel Doctor',
    title: 'Find out why your channel isn’t growing',
    text: 'Connect your channel and get a plain-language diagnosis from your own YouTube Analytics: what’s holding you back and what to fix first.',
    points: ['Clicks, watch time and reach, compared with your own usual', 'Your recent videos checked, thumbnails included', 'What to fix first'],
    mock: DoctorMock,
  },
  {
    id: 'discover',
    icon: Compass,
    eyebrow: 'Discover',
    title: 'See what to make next',
    text: 'Add your competitors and get video ideas backed by numbers: what’s rising, where there’s room, and what fits your channel.',
    points: ['Finds competitor channels for you', 'Spots topics that are rising or under-served', 'Every idea shows the evidence behind it'],
    mock: DiscoverMock,
  },
  {
    id: 'create',
    icon: PenLine,
    eyebrow: 'Create',
    title: 'From idea to script, title and thumbnail',
    text: 'Turn an idea into a full video plan. See who already made videos on the topic, then get a brief, a script, title ideas and thumbnail ideas.',
    points: ['Script written part by part, with facts marked to check', 'Title and thumbnail ideas that work together', 'Send the script straight to voice and scenes'],
    mock: CreateMock,
  },
  {
    id: 'audit',
    icon: Search,
    eyebrow: 'Analyze',
    title: 'Learn why any video worked',
    text: 'Paste a link to any video or channel, yours or a competitor’s, and see why it did well or didn’t.',
    points: ['Compared with that channel’s own usual views', 'Title, thumbnail and description checked', 'What viewers say in the comments'],
    mock: AnalyzeMock,
  },
];

/** One row per growth tool: what it does, an illustration with example numbers, and which plans include it (live). */
export const GrowthToolsShowcaseSection: React.FC = () => {
  const catalog = usePricingCatalog();
  const toolOf = (id: GrowthToolId) => catalog?.tools.find((t) => t.id === id);

  return (
    <section id="growth-tools" className="py-20 sm:py-24 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5] text-zinc-900">
      <div className="max-w-7xl mx-auto space-y-20">
        {TOOLS.map((tool, i) => {
          const Icon = tool.icon;
          const Mock = tool.mock;
          const live = toolOf(tool.id);
          const plans = live?.plans;
          return (
            <div key={tool.id} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className={`space-y-5 ${i % 2 ? 'lg:order-2' : ''}`}>
                <p className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#E05A30]">
                  <Icon size={15} />
                  {tool.eyebrow}
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">{tool.title}</h2>
                <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">{tool.text}</p>
                <ul className="space-y-2">
                  {tool.points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-zinc-800">
                      <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
                {plans && plans.length > 0 && (
                  <p className="text-xs font-semibold text-zinc-500">
                    Included in: {plansText(plans)}
                    {live.freeOnTrial > 0 && <span className="text-[#E05A30]"> · your first diagnosis is free</span>}
                  </p>
                )}
              </div>
              <div className={i % 2 ? 'lg:order-1' : ''}>
                <Mock />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
