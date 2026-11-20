'use client';

/** The landing page, Bangla first with an English switch. It brings its own header and footer; the shared ones hide on "/". */
import { useLocale } from 'next-intl';
import { anek, hind } from './fonts';
import { Footer, Header, Prices } from './chrome';
import { Hero, NextShortsStrip, Pains, ReportStory, Reviews, Tools } from './sections';
import { useSignedIn } from './use-signed-in';

export default function BanglaLanding() {
  const signedIn = useSignedIn();
  const locale = useLocale();
  const startHref = signedIn ? '/home' : '/login?mode=signup';
  return (
    <div lang={locale} className={`${anek.variable} ${hind.variable} overflow-hidden bg-[#F6F1E7] text-lg leading-relaxed text-[#13261F] [font-family:var(--font-hind)]`}>
      <Header signedIn={signedIn} />
      <Hero startHref={startHref} />
      <Pains />
      <Reviews />
      <ReportStory />
      {/* <NextShortsStrip /> */}
      <Tools />
      <Prices startHref={startHref} />
      <Footer startHref={startHref} />
    </div>
  );
}
