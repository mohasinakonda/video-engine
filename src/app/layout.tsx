import type { Metadata } from 'next';
import './globals.css';
import { DM_Sans } from 'next/font/google'
import AppShell from '@/components/app-shell';

const dm_sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  fallback: ['system-ui', 'arial'],
  weight: ['400', '500', '600', '700', '800', '900']
})


export const metadata: Metadata = {
  title: 'AI Video Studio',
  description: 'Convert long-form narration scripts into cinematic video & audio — powered by Pollinations AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dm_sans.variable} dark`}>
      <body className="min-h-screen bg-bg-base text-slate-100 antialiased font-sans">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
