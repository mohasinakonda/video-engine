import React from 'react';
import { CreditCard, Hash, Languages, Mic, Search, ShieldCheck } from 'lucide-react';

const POINTS = [
  { icon: Languages, title: 'Bangla scripts and plans', text: 'Briefs, scripts, titles and thumbnail text written in Bangla, not translated from English.' },
  { icon: Mic, title: 'Your own Bangla voice', text: 'Upload your Bangla narration and the scenes and subtitles sync to it automatically.' },
  { icon: Search, title: 'Searches tuned for Bangla', text: 'Topic searches look for Bangla videos and show how many exist, so you can spot the gaps.' },
  { icon: Hash, title: 'Bangla hashtags', text: 'Descriptions come with hashtags in Bangla that match the topic.' },
  { icon: CreditCard, title: 'Pay with bKash or Nagad', text: 'Local payment, prices in taka, activated over WhatsApp.' },
  { icon: ShieldCheck, title: 'Safe to connect', text: 'YouTube’s official, read-only access. We never post, and you can disconnect anytime.' },
];

/** Why Rendoza fits Bangla creators better than tools built for English only. */
export const BanglaCreatorsSection: React.FC = () => {
  return (
    <section id="bangla" className="py-20 sm:py-24 px-6 border-b border-[#E5E0D8] bg-white text-zinc-900">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="max-w-2xl space-y-4">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">MADE FOR BANGLA CREATORS</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            বাংলায় কনটেন্ট, <span className="text-zinc-500 font-medium">from idea to upload.</span>
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
            Most YouTube tools are built for English. Rendoza works in Bangla at every step, and in English when you need it.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {POINTS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E0D8] flex items-center justify-center text-[#E05A30]">
                  <Icon size={19} strokeWidth={1.8} />
                </div>
                <h3 className="text-sm font-bold text-zinc-950">{p.title}</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">{p.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
