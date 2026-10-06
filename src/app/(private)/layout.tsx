import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/app-shell';

export default async function PrivateLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let user = null;

    try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        user = data?.user ?? null;
    } catch {
        user = null;
    }

    if (!user) {
        redirect('/login');
    }

    return <AppShell>{children}</AppShell>;
}


