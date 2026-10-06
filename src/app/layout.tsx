import type { Metadata } from 'next';
import './globals.css';
import { DM_Sans } from 'next/font/google';
import AppShell from '@/components/app-shell';
import JsonLd from '@/components/seo/json-ld';

const dm_sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  fallback: ['system-ui', 'arial'],
  weight: ['400', '500', '600', '700', '800', '900'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rendoza.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Rendoza AI - AI Video Generator & Script to Video Studio',
    template: '%s | Rendoza AI',
  },
  description:
    'Convert scripts and narration into cinematic videos in minutes with Rendoza AI. High-quality visuals, synchronized audio voiceovers, zero watermarks, and 1080p MP4 exports.',
  keywords: [
    'AI video generator',
    'script to video AI',
    'AI video studio',
    'text to video generator',
    'faceless YouTube video maker',
    'AI storyboard editor',
    'automated video generator',
    'AI voiceover to video',
    'Rendoza AI',
  ],
  authors: [{ name: 'Rendoza AI' }],
  creator: 'Rendoza AI',
  publisher: 'Rendoza AI',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rendoza AI - AI Video Generator & Script to Video Studio',
    description:
      'Turn long-form narration scripts into cinematic video & audio scenes with Rendoza AI. Zero watermarks and 1080p export.',
    url: siteUrl,
    siteName: 'Rendoza AI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rendoza AI - AI Video Generator & Script to Video Studio',
    description:
      'Turn long-form narration scripts into cinematic video & audio scenes with Rendoza AI. Zero watermarks and 1080p export.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dm_sans.variable} dark`}>
      <head>
        <JsonLd />
      </head>
      <body className="min-h-screen bg-bg-base text-slate-100 antialiased font-sans">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

