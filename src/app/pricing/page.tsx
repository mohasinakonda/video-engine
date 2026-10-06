import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import PricingClient from './pricing-client';

export const metadata: Metadata = {
  title: 'Pricing Plans & Credits',
  description:
    'Choose the perfect plan for your AI video production. Transparent pricing, free credits on signup, and local payment methods supported.',
  alternates: {
    canonical: '/pricing',
  },
};

export const dynamic = 'force-dynamic';


export default async function PricingPage() {
  let user = null;

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  return <PricingClient initialUser={user} />;
}
