import React from 'react';
import { LandingNavbar } from '@/components/landing/navbar';
import { LandingFooter } from '@/components/landing/footer';
import { LocalProvider } from '@/components/landing-bn/localProvider';
import { OfferBanner } from '@/components/global/offer-banner';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-zinc-900 selection:bg-orange-100 selection:text-orange-950 font-sans antialiased overflow-x-clip flex flex-col justify-between">
      <LocalProvider>
        <OfferBanner />
        <LandingNavbar />
        <main className="flex-1">{children}</main>
        <LandingFooter />
      </LocalProvider>
    </div>
  );
}
