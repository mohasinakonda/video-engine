import UserDashboardView from "@/components/user-dashboard-view";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {

    let user = null;

    try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        user = data?.user ?? null;
    } catch {
        user = null;
    }


    return (
        <UserDashboardView user={user} />

    );
}