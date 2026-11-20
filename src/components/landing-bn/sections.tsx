'use client';

/**
 * The landing page, section by section: a poster-like hero with a sample report slip, what creators
 * say most, one Short's week annotated, the next Short as a film strip, and the rest of the tools.
 * Words come from messages/<locale>.json; report numbers are a labelled sample, not a real channel.
 */
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const display = '[font-family:var(--font-anek)]';
const wrap = 'mx-auto max-w-[1180px] px-4 sm:px-10';
const red = '#C2461F';
const ink = '#13261F';
const TONE: Record<string, string> = { stop: red, ok: ink, wait: '#5B6B63' };
const DAY_BARS = [
  { h: 92, c: ink },
  { h: 22, c: red },
  { h: 6, c: '#A9B3AD' },
  { h: 3, c: '#A9B3AD' },
  { h: 2, c: '#A9B3AD' },
  { h: 1, c: '#A9B3AD' },
  { h: 1, c: '#A9B3AD' },
];
const NOTE_COLORS = [ink, red, '#0B6E4F'];
const SHOT_COLORS = ['#3D5A4C', '#6F7F66', '#A8956F', '#D8C7A3'];

type Row = { name: string; views: string; state: string; tone: string };
type Pain = { n: string; quote: string; answer: string };
type Day = { label: string; v: string };
type Note = { label: string; text: string };
type Shot = { n: string; time: string; title: string; body: string };
type Tool = { title: string; body: string };

export function CtaButton({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[58px] items-center gap-3 bg-[#C2461F] px-7 text-xl font-bold text-white transition-colors hover:bg-[#A63A16] active:translate-y-px ${className}`}
    >
      {children}
      <ArrowRight size={20} strokeWidth={2.4} aria-hidden="true" />
    </Link>
  );
}

export function Hero({ startHref }: { startHref: string }) {
  const t = useTranslations('landing');
  const rows = t.raw('slip.rows') as Row[];
  return (
    <section className={`${wrap} flex flex-wrap items-start gap-10 pb-14 pt-10 sm:gap-16 sm:pb-24 sm:pt-20`}>
      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-7">
        <h1 className={`${display} text-[clamp(44px,6.6vw,100px)] font-extrabold leading-[0.98] tracking-[-0.02em]`}>
          <span className="block whitespace-nowrap">{t('hero.line1')}</span>
          <span className="block whitespace-nowrap">{t('hero.line2')}</span>
        </h1>
        <p className={`${display} text-[clamp(26px,2.8vw,38px)] font-semibold leading-tight text-[#C2461F]`}>{t('hero.answer')}</p>
        <p className="max-w-[540px] text-[clamp(18px,1.6vw,21px)] leading-relaxed text-[#33463E]">{t('hero.body')}</p>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3.5">
          <CtaButton href={startHref}>{t('hero.cta')}</CtaButton>
          <a href="#report" className="text-lg font-semibold underline decoration-2 underline-offset-[5px] hover:text-[#C2461F]">
            {t('hero.sample')}
          </a>
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-[#C9BFAE] pt-3.5 text-[15px] text-[#4A5B53]">
          {(t.raw('hero.trust') as string[]).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <aside aria-label={t('slip.label')} className="mt-3 min-w-0 max-w-[440px] flex-[1_1_360px] border-2 border-[#13261F] bg-[#FFFDF8] shadow-[10px_10px_0_#13261F]">
        <div className="flex items-baseline justify-between gap-2.5 border-b-2 border-[#13261F] px-[18px] py-3.5">
          <strong className={`${display} text-[22px] font-bold`}>{t('slip.title')}</strong>
          <span className="text-sm text-[#5B6B63]">{t('slip.meta')}</span>
        </div>
        <ol>
          {rows.map((s) => (
            <li key={s.name} className="flex items-center gap-3 border-b border-dashed border-[#C9BFAE] px-[18px] py-[11px] text-base">
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="tabular-nums text-[#4A5B53]">{s.views}</span>
              <span className="min-w-[64px] text-right font-bold" style={{ color: TONE[s.tone] ?? ink }}>
                {s.state}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 px-[18px] pb-[18px] pt-4">
          <span className="text-sm font-bold text-[#C2461F]">{t('slip.causeLabel')}</span>
          <p className={`${display} text-[22px] font-semibold leading-snug`}>{t('slip.cause')}</p>
          <p className="mt-1.5 text-base text-[#33463E]">
            <strong className="text-[#13261F]">{t('slip.firstLabel')}</strong> {t('slip.first')}
          </p>
        </div>
      </aside>
    </section>
  );
}

export function Pains() {
  const t = useTranslations('landing.pains');
  return (
    <section aria-labelledby="pain-h" className="border-y-2 border-[#13261F] bg-[#EDE5D6]">
      <div className={`${wrap} py-10 sm:py-16`}>
        <h2 id="pain-h" className={`${display} mb-5 text-[clamp(28px,3vw,40px)] font-bold leading-tight`}>
          {t('title')}
        </h2>
        <ol>
          {(t.raw('items') as Pain[]).map((p) => (
            <li key={p.n} className="flex flex-wrap items-baseline gap-x-7 gap-y-1.5 border-t border-[#B9AE9B] py-[18px]">
              <span className={`${display} w-14 shrink-0 text-[44px] font-extrabold leading-none text-[#C2461F]`}>{p.n}</span>
              <span className={`${display} flex-[1_1_320px] text-[clamp(24px,2.4vw,32px)] font-semibold leading-tight`}>“{p.quote}”</span>
              <span className="flex-[1_1_320px] text-[17px] text-[#33463E]">{p.answer}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

type Review = { quote: string; result: string; resultLabel: string; who: string; translation: string; image: string; w: number; h: number };

/** Real messages from creators: the WhatsApp screenshots themselves (the words as alt text), with the views they showed. */
export function Reviews() {
  const t = useTranslations('landing.reviews');
  return (
    <section aria-labelledby="reviews-h" className={`${wrap} flex flex-col gap-8 pt-16 sm:pt-24`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-2">
        <h2 id="reviews-h" className={`${display} text-[clamp(32px,3.6vw,52px)] font-extrabold leading-[1.05]`}>
          {t('title')}
        </h2>

      </div>
      <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-3">
        {(t.raw('items') as Review[]).map((r) => (
          <li key={r.quote} className="flex flex-col gap-4 py-6">

            <figure className="overflow-hidden border-2 border-[#13261F] bg-white shadow-[6px_6px_0_#13261F]">
              <Image src={r.image} width={r.w} height={r.h} alt={r.quote} sizes="(min-width: 768px) 360px, 100vw" className="h-auto w-full" />
            </figure>

          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHead({ line1, line2, body, dark = false }: { line1: string; line2: string; body: string; dark?: boolean }) {
  return (
    <div >
      <h2 className={`${display} max-w-2xl flex-[1_1_520px] text-[clamp(40px,5vw,72px)] font-extrabold leading-none tracking-[-0.01em]`}>
        {line1}

        {line2}
      </h2>
      <p className={`max-w-[420px] flex-[1_1_320px] text-lg ${dark ? 'text-[#C9D3CC]' : 'text-[#33463E]'}`}>{body}</p>
    </div>
  );
}

export function ReportStory() {
  const t = useTranslations('landing.report');
  const days = t.raw('days') as Day[];
  const notes = t.raw('notes') as Note[];
  return (
    <section id="report" className={`${wrap} flex scroll-mt-6 flex-col gap-9 py-16 sm:py-28`}>
      <SectionHead line1={t('line1')} line2={t('line2')} body={t('body')} />
      <figure aria-label={t('figureLabel')} className="flex flex-col gap-3.5 border-2 border-[#13261F] bg-[#FFFDF8] p-[18px] sm:p-8">
        <div className="flex flex-wrap justify-between gap-2">
          <strong className="text-lg">{t('figureTitle')}</strong>
          <span className="text-[15px] text-[#5B6B63]">{t('figureMeta')}</span>
        </div>
        <div className="flex h-[260px] items-end gap-2 border-b-2 border-[#13261F] sm:gap-[18px]">
          {days.map((d, i) => (
            <div key={d.label} className="flex h-full flex-1 flex-col justify-end gap-1.5">
              <span className="text-center text-sm tabular-nums text-[#33463E]">{d.v}</span>
              <span style={{ height: `${DAY_BARS[i]?.h ?? 1}%`, background: DAY_BARS[i]?.c ?? '#A9B3AD' }} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 sm:gap-[18px]">
          {days.map((d) => (
            <span key={d.label} className="flex-1 text-center text-[13px] text-[#5B6B63] sm:text-[15px]">
              {d.label}
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 border-t border-[#C9BFAE] sm:grid-cols-3">
          {notes.map((n, i) => (
            <div key={n.label} className="flex flex-col gap-1 pb-1 pr-[18px] pt-4">
              <span className="text-sm font-bold" style={{ color: NOTE_COLORS[i] ?? ink }}>
                {n.label}
              </span>
              <span className="text-[17px] leading-snug">{n.text}</span>
            </div>
          ))}
        </div>
      </figure>
    </section>
  );
}

export function NextShortsStrip() {
  const t = useTranslations('landing.next');
  return (
    <section id="next" className="scroll-mt-6 bg-[#13261F] text-[#F6F1E7]">
      <div className={`${wrap} flex flex-col gap-9 py-16 sm:py-28`}>
        <SectionHead dark line1={t('line1')} line2={t('line2')} body={t('body')} />
        <ol aria-label={t('stripLabel')} className="grid grid-cols-2 gap-3.5 border-y-[10px] border-dashed border-[#2C4339] bg-[#0B1712] p-3.5 lg:grid-cols-4">
          {(t.raw('shots') as Shot[]).map((s, i) => (
            <li key={s.n} className="flex flex-col gap-2.5">
              <div className="relative aspect-[9/13]" style={{ background: SHOT_COLORS[i] ?? '#3D5A4C' }}>
                <span className="absolute left-0 top-0 bg-[#F6F1E7] px-2.5 py-1 text-sm font-bold text-[#13261F]">{s.time}</span>
              </div>
              <strong className="text-lg">
                {t('shot')} {s.n} · {s.title}
              </strong>
              <span className="text-base leading-snug text-[#C9D3CC]">{s.body}</span>
            </li>
          ))}
        </ol>
        <p className="text-lg text-[#C9D3CC]">
          <strong className="text-[#F6F1E7]">{t('pasteStrong')}</strong> {t('paste')}
        </p>
      </div>
    </section>
  );
}

export function Tools() {
  const t = useTranslations('landing.tools');
  return (
    <section aria-labelledby="also-h" className={`${wrap} flex flex-wrap gap-x-16 gap-y-6 py-16 sm:py-24`}>
      <h2 id="also-h" className={`${display} flex-[1_1_300px] text-[clamp(34px,3.6vw,52px)] font-extrabold leading-[1.05]`}>
        {t('title')}
      </h2>
      <dl className="grid flex-[2_1_520px] grid-cols-1 gap-x-10 sm:grid-cols-2">
        {(t.raw('items') as Tool[]).map((tool) => (
          <div key={tool.title} className="flex flex-col gap-1 border-t-2 border-[#13261F] py-[18px]">
            <dt className={`${display} text-2xl font-bold`}>{tool.title}</dt>
            <dd className="text-[17px] text-[#33463E]">{tool.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
