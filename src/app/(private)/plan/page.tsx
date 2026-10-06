import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import PlanClient from './plan-client';
// import PlanClient from './plan-client';

export const metadata: Metadata = {
    title: 'My Plan & Credits | Rendoza AI',
    description: 'Manage your active subscription, top-up image credits, and view billing history.',
};

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
    let user = null;

    try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        user = data?.user ?? null;
    } catch {
        user = null;
    }

    return <PlanClient initialUser={user} />;
}
