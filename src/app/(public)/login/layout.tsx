import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In / Sign Up - Free Account',
  description: 'Sign in to Rendoza AI Studio or create a free account to get free credits to make your first video.',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
