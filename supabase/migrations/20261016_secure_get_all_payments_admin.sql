-- get_all_payments_admin had no admin check and was executable by anon, so anyone
-- with the public anon key could read every payment (emails, bKash numbers, TrxIDs).

create or replace function public.get_all_payments_admin()
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin-only: everyone else gets no rows (callers fall back to RLS-scoped reads).
  if not public.is_service_or_admin() then
    return;
  end if;
  return query select * from public.payments order by submitted_at desc;
end;
$$;

revoke execute on function public.get_all_payments_admin() from public, anon;
grant execute on function public.get_all_payments_admin() to authenticated, service_role;

alter table if exists public.test_table enable row level security;
