import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In / Sign Up - Free Account',
  description: 'Sign in to Rendoza AI Studio or create a free account to get 30 free video generation credits.',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
