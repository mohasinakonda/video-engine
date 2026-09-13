import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Video Studio',
  description: 'Convert long-form narration scripts into cinematic video & audio — powered by Pollinations AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-base text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
