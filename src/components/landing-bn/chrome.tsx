'use client';

/** The landing page's header (with the language switch), prices (the real plans) and footer. */
import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePricingPlans } from '@/hooks/use-pricing';
import { formatWhatsAppLink } from '@/lib/subscription-store';
import { bn } from './fonts';
import { CtaButton, display } from './sections';
import { AppLogo } from '@/icons/logo-icon';

const wrap = 'mx-auto max-w-[1180px] px-4 sm:px-10';

/** Bangla ⇄ English: saved in the NEXT_LOCALE cookie for a year, then the page re-renders on the server. */
function LanguageSwitch() {
  const t = useTranslations('landing');
  const locale = useLocale();

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // const next = locale === 'bn' ? 'en' : 'bn';
  const next = 'en'
  return (
    <button
      type="button"
      lang={next}
      aria-label={t('switchLabel')}
      disabled={pending}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
        startTransition(() => router.refresh());
      }}
      className="inline-flex min-h-[44px] items-center border-2 border-[#13261F] px-3.5 font-semibold hover:bg-[#EDE5D6] disabled:opacity-60"
    >
      {t('switchTo')}
    </button>
  );
}

export function Header({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations('landing.nav');
  return (
    <header className="border-b-2 border-[#13261F]">
      <div className={`${wrap} flex flex-wrap items-center justify-between gap-3.5 py-4`}>
        <Link href="/" className={`${display} text-[30px] font-extrabold leading-none tracking-[-0.02em] flex gap-1 items-center `}>
          <span className='shrink-0 w-8 rounded'>

            <AppLogo className='rounded' />
          </span>
          <span className='text-lg'>Rendoza AI</span>
        </Link>
        <nav aria-label={t('main')} className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[17px] font-medium">
          <a href="#report" className="hover:text-[#C2461F]">
            {t('views')}
          </a>
          <a href="#next" className="hover:text-[#C2461F]">
            {t('next')}
          </a>
          <a href="#price" className="hover:text-[#C2461F]">
            {t('price')}
          </a>
          {/* <LanguageSwitch /> */}
          <Link href={signedIn ? '/home' : '/login'} className="inline-flex min-h-[44px] items-center bg-[#13261F] px-[18px] font-semibold text-[#F6F1E7] hover:bg-[#0B1712]">
            {signedIn ? t('dashboard') : t('login')}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Prices({ startHref }: { startHref: string }) {
  const t = useTranslations('landing.price');
  const locale = useLocale();
  const num = (n: number) => (locale === 'bn' ? bn(n.toLocaleString('en-US')) : n.toLocaleString('en-US'));
  const { plans, isLoading } = usePricingPlans();
  const shown = plans.filter((p) => p.isActive !== false && p.id !== 'TRIAL').sort((a, b) => a.priceMonthly - b.priceMonthly);

  return (
    <section id="price" className={`${wrap} flex scroll-mt-6 flex-col gap-8 py-16 sm:py-28`}>
      <div className="">
        <h2 className={`${display} flex-[1_1_420px] text-[clamp(40px,5vw,72px)] font-extrabold leading-none`}>{t('title')}</h2>
        <p className="flex-[1_1_320px] text-lg text-[#33463E]">{t('body')}</p>
      </div>
      {isLoading && shown.length === 0 ? (
        <div role="status" className="grid grid-cols-1 border-t-2 border-[#13261F] md:grid-cols-3">
          <span className="sr-only">{t('loading')}</span>
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden="true" className="flex animate-pulse flex-col gap-4 py-6 pr-6">
              <div className="h-7 w-28 bg-[#E4DBCB]" />
              <div className="h-12 w-40 bg-[#E4DBCB]" />
              <div className="h-24 w-full bg-[#EDE5D6]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 border-t-2 border-[#13261F] md:grid-cols-3">
          {shown.map((p) => (
            <div key={p.id} className={`-mt-0.5 flex flex-col gap-3.5 pb-7 pr-6 pt-6 ${p.popular ? 'border-t-[6px] border-[#C2461F]' : 'border-t-2 border-[#13261F]'}`}>
              <div className="flex min-h-[52px] flex-col gap-0.5">
                <strong className={`${display} text-[26px] font-bold`}>{p.name}</strong>
                {p.popular && <span className="text-sm font-bold text-[#C2461F]">{t('popular')}</span>}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`${display} text-[52px] font-extrabold leading-none`}>৳{num(p.priceMonthly)}</span>
                <span className="text-base text-[#5B6B63]">{t('perMonth')}</span>
              </div>
              <span className="text-base text-[#33463E]">{t('credits', { credits: num(p.creditsPerMonth) })}</span>
              <ul className="flex flex-1 flex-col gap-2 border-t border-[#C9BFAE] pt-3.5">
                {p.features.map((f) => (
                  <li key={f} className="relative pl-5 text-[17px]">
                    <span aria-hidden="true" className="absolute left-0 top-0 font-bold text-[#C2461F]">
                      —
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={startHref}
                className={`inline-flex min-h-[48px] items-center self-start border-2 border-[#13261F] px-5 font-bold ${p.popular ? 'bg-[#13261F] text-[#F6F1E7] hover:bg-[#0B1712]' : 'hover:bg-[#EDE5D6]'}`}
              >
                {t('choose', { name: p.name })}
              </Link>
            </div>
          ))}
        </div>
      )}
      <Link href="/pricing" className="self-start text-[17px] font-semibold underline decoration-2 underline-offset-[5px] hover:text-[#C2461F]">
        {t('more')}
      </Link>
    </section>
  );
}

export function Footer({ startHref }: { startHref: string }) {
  const t = useTranslations('landing.footer');
  const { settings } = usePricingPlans();
  const whatsapp = formatWhatsAppLink(settings?.whatsappNumber, 'Hello! I would like to know more about Rendoza.');
  return (
    <footer className="bg-[#13261F] text-[#F6F1E7]">
      <div className={`${wrap} flex flex-col gap-12 pb-9 pt-14 sm:pt-24`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <p className={`${display} text-[clamp(44px,6vw,88px)] font-extrabold leading-[0.98]`}>
            {t('line1')}
            <br />
            {t('line2')}
          </p>
          <CtaButton href={startHref}>{t('cta')}</CtaButton>
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-[#2C4339] pt-5 text-[15px] text-[#C9D3CC]">
          <span>{t('note')}</span>
          <nav aria-label={t('label')} className="flex flex-wrap gap-x-5 gap-y-2 text-[#F6F1E7]">
            <Link href="/privacy" className="hover:underline">
              {t('privacy')}
            </Link>
            <Link href="/terms" className="hover:underline">
              {t('terms')}
            </Link>
            <Link href="/refund" className="hover:underline">
              {t('refund')}
            </Link>
            <Link href="/acceptable-use" className="hover:underline">
              {t('use')}
            </Link>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {t('contact')}
              </a>
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
}
