-- ════════════════════════════════════════════════════════════════════════════
-- Affiliate commission ledger
--
-- One row per referred sale, recorded by a trigger on payments so it works with
-- every version of approve_payment_admin. Each commission is held for 14 days
-- (refund window) before it can be withdrawn. Payouts go through a server-side
-- RPC that checks the withdrawable balance.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- Columns the live database already has; added here so a fresh setup matches.
alter table public.profiles add column if not exists affiliate_earnings_bdt int default 0;
alter table public.profiles add column if not exists referral_commission_percent int default 15;
alter table public.profiles add column if not exists referral_discount_percent int default 20;

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id) on delete cascade,
  payment_id text not null unique references public.payments(id) on delete cascade,
  customer_email text,
  item_label text,
  order_amount_bdt int not null,
  commission_percent int not null,
  commission_bdt int not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVERSED')),
  available_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_commissions_affiliate_idx
  on public.affiliate_commissions (affiliate_id, created_at desc);

alter table public.affiliate_commissions enable row level security;

-- Affiliates read their own rows only through get_affiliate_dashboard() (masked emails).
drop policy if exists "Admins can view affiliate commissions" on public.affiliate_commissions;
create policy "Admins can view affiliate commissions"
  on public.affiliate_commissions for select
  using (public.is_admin());

-- ─── Record / reverse commission when a payment is approved / un-approved ────

create or replace function public.sync_affiliate_commission()
returns trigger as $$
declare
  v_affiliate_id uuid;
  v_percent int;
  v_amount int;
  -- Scalars (not a record) so an empty RETURNING leaves them null instead of erroring.
  v_hit_affiliate uuid;
  v_hit_amount int;
begin
  -- Payment approved: record the commission, on hold for 14 days.
  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED'
     and coalesce(trim(new.promo_code_applied), '') <> '' then
    select id, least(greatest(coalesce(referral_commission_percent, 15), 0), 50)
      into v_affiliate_id, v_percent
      from public.profiles
     where upper(referral_code) = upper(trim(new.promo_code_applied));

    if found and v_affiliate_id is distinct from new.user_id then
      v_amount := round((coalesce(new.discounted_price_bdt, 0) * v_percent)::numeric / 100.0);

      if v_amount > 0 then
        insert into public.affiliate_commissions (
          affiliate_id, payment_id, customer_email, item_label,
          order_amount_bdt, commission_percent, commission_bdt, status, available_at
        ) values (
          v_affiliate_id,
          new.id,
          new.user_email,
          case
            when new.item_type = 'subscription'
              then coalesce(new.plan_id, 'Plan') || case when new.billing_cycle = 'quarterly' then ' · 3 months' else ' · monthly' end
            else 'Credit top-up'
          end,
          coalesce(new.discounted_price_bdt, 0),
          v_percent,
          v_amount,
          'ACTIVE',
          now() + interval '14 days'
        )
        -- Re-approving a previously reversed payment reactivates its commission.
        on conflict (payment_id) do update
          set status = 'ACTIVE', available_at = excluded.available_at
          where public.affiliate_commissions.status = 'REVERSED'
        returning affiliate_id, commission_bdt into v_hit_affiliate, v_hit_amount;

        if v_hit_affiliate is not null then
          update public.profiles
          set
            affiliate_earnings_bdt = coalesce(affiliate_earnings_bdt, 0) + v_hit_amount,
            referral_earnings_bdt = coalesce(referral_earnings_bdt, 0) + v_hit_amount,
            referral_pending_bdt = coalesce(referral_pending_bdt, 0) + v_hit_amount,
            referral_count = coalesce(referral_count, 0) + 1,
            updated_at = now()
          where id = v_hit_affiliate;
        end if;
      end if;
    end if;

  -- Approved payment taken back (refund / rejected later): reverse its commission.
  elsif old.status = 'APPROVED' and new.status is distinct from 'APPROVED' then
    update public.affiliate_commissions
       set status = 'REVERSED'
     where payment_id = new.id and status = 'ACTIVE'
    returning affiliate_id, commission_bdt into v_hit_affiliate, v_hit_amount;

    if v_hit_affiliate is not null then
      update public.profiles
      set
        affiliate_earnings_bdt = greatest(0, coalesce(affiliate_earnings_bdt, 0) - v_hit_amount),
        referral_earnings_bdt = greatest(0, coalesce(referral_earnings_bdt, 0) - v_hit_amount),
        referral_pending_bdt = greatest(0, coalesce(referral_pending_bdt, 0) - v_hit_amount),
        referral_count = greatest(0, coalesce(referral_count, 0) - 1),
        updated_at = now()
      where id = v_hit_affiliate;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_sync_affiliate_commission on public.payments;
create trigger trg_sync_affiliate_commission
  after update of status on public.payments
  for each row execute function public.sync_affiliate_commission();

-- The trigger above now records commissions. approve_payment_admin still calls
-- this function, so it stays as a no-op to avoid crediting twice.
create or replace function public.credit_affiliate_commission(
  p_referral_code text,
  p_order_amount_bdt int,
  p_commission_percent int default 15
)
returns boolean as $$
begin
  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- ─── Affiliate dashboard (own data, customer emails masked) ──────────────────

create or replace function public.get_affiliate_dashboard()
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_matured int;
  v_requested int;
  v_paid int;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(sum(commission_bdt), 0) into v_matured
    from public.affiliate_commissions
   where affiliate_id = v_uid and status = 'ACTIVE' and available_at <= now();

  select coalesce(sum(amount_bdt) filter (where status = 'PENDING'), 0),
         coalesce(sum(amount_bdt) filter (where status = 'PAID'), 0)
    into v_requested, v_paid
    from public.affiliate_payouts
   where user_id = v_uid;

  select jsonb_build_object(
    'holdDays', 14,
    'minPayoutBdt', 500,
    'salesCount', (select count(*) from public.affiliate_commissions where affiliate_id = v_uid and status = 'ACTIVE'),
    'earnedBdt', (select coalesce(sum(commission_bdt), 0) from public.affiliate_commissions where affiliate_id = v_uid and status = 'ACTIVE'),
    'onHoldBdt', (select coalesce(sum(commission_bdt), 0) from public.affiliate_commissions where affiliate_id = v_uid and status = 'ACTIVE' and available_at > now()),
    'nextReleaseAt', (select min(available_at) from public.affiliate_commissions where affiliate_id = v_uid and status = 'ACTIVE' and available_at > now()),
    'availableBdt', greatest(0, v_matured - v_requested - v_paid),
    'requestedBdt', v_requested,
    'paidBdt', v_paid,
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'createdAt', c.created_at,
        'customer', case
          when position('@' in coalesce(c.customer_email, '')) > 1
            then left(split_part(c.customer_email, '@', 1), 2) || '***@' || split_part(c.customer_email, '@', 2)
          else 'Customer'
        end,
        'item', c.item_label,
        'orderBdt', c.order_amount_bdt,
        'percent', c.commission_percent,
        'commissionBdt', c.commission_bdt,
        'status', case
          when c.status = 'REVERSED' then 'REVERSED'
          when c.available_at > now() then 'ON_HOLD'
          else 'AVAILABLE'
        end,
        'availableAt', c.available_at
      ) order by c.created_at desc)
      from (
        select * from public.affiliate_commissions
         where affiliate_id = v_uid
         order by created_at desc
         limit 100
      ) c
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'requestedAt', p.requested_at,
        'amountBdt', p.amount_bdt,
        'method', p.payment_method,
        'account', p.account_number,
        'status', p.status,
        'paidAt', p.paid_at,
        'note', p.note
      ) order by p.requested_at desc)
      from (
        select * from public.affiliate_payouts
         where user_id = v_uid
         order by requested_at desc
         limit 50
      ) p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer set search_path = public;

-- ─── Payout request (balance checked on the server) ──────────────────────────

create or replace function public.request_affiliate_payout(
  p_amount_bdt int,
  p_payment_method text,
  p_account_number text
)
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_matured int;
  v_requested int;
  v_paid int;
  v_available int;
  v_id text;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  if p_payment_method not in ('bkash', 'nagad', 'bank') then
    return jsonb_build_object('ok', false, 'error', 'Invalid payment method.');
  end if;
  if coalesce(trim(p_account_number), '') = '' or length(trim(p_account_number)) > 64 then
    return jsonb_build_object('ok', false, 'error', 'Please enter a valid account number.');
  end if;
  if p_amount_bdt is null or p_amount_bdt < 500 then
    return jsonb_build_object('ok', false, 'error', 'Minimum payout is ৳500.');
  end if;

  -- Lock the affiliate's profile so two requests can't both pass the balance check.
  select email into v_email from public.profiles where id = v_uid for update;

  if exists (select 1 from public.affiliate_payouts where user_id = v_uid and status = 'PENDING') then
    return jsonb_build_object('ok', false, 'error', 'You already have a payout request in progress.');
  end if;

  select coalesce(sum(commission_bdt), 0) into v_matured
    from public.affiliate_commissions
   where affiliate_id = v_uid and status = 'ACTIVE' and available_at <= now();

  select coalesce(sum(amount_bdt) filter (where status = 'PENDING'), 0),
         coalesce(sum(amount_bdt) filter (where status = 'PAID'), 0)
    into v_requested, v_paid
    from public.affiliate_payouts
   where user_id = v_uid;

  v_available := greatest(0, v_matured - v_requested - v_paid);
  if p_amount_bdt > v_available then
    return jsonb_build_object('ok', false, 'error', 'Amount is more than your withdrawable balance of ৳' || v_available || '.');
  end if;

  v_id := 'payout_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.affiliate_payouts (id, user_id, user_email, amount_bdt, payment_method, account_number, status, requested_at)
  values (v_id, v_uid, v_email, p_amount_bdt, p_payment_method, trim(p_account_number), 'PENDING', now());

  update public.profiles
     set referral_pending_bdt = greatest(0, coalesce(referral_pending_bdt, 0) - p_amount_bdt),
         updated_at = now()
   where id = v_uid;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$ language plpgsql security definer set search_path = public;

-- Payout rows may only be created through request_affiliate_payout().
drop policy if exists "Users can submit payouts" on public.affiliate_payouts;

-- ─── Admin: settle or reject a payout request ────────────────────────────────

create or replace function public.admin_resolve_affiliate_payout(
  p_payout_id text,
  p_paid boolean,
  p_note text default null
)
returns boolean as $$
declare
  v_user uuid;
  v_amount int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can resolve payouts';
  end if;

  update public.affiliate_payouts
     set status = case when p_paid then 'PAID' else 'REJECTED' end,
         paid_at = case when p_paid then now() else null end,
         note = coalesce(p_note, case when p_paid then 'Paid via bKash/Nagad' else 'Rejected by admin' end)
   where id = p_payout_id and status = 'PENDING'
  returning user_id, amount_bdt into v_user, v_amount;

  if not found then
    return false;
  end if;

  if p_paid then
    update public.profiles
       set referral_paid_bdt = coalesce(referral_paid_bdt, 0) + v_amount, updated_at = now()
     where id = v_user;
  else
    -- Rejected: the amount becomes withdrawable again.
    update public.profiles
       set referral_pending_bdt = coalesce(referral_pending_bdt, 0) + v_amount, updated_at = now()
     where id = v_user;
  end if;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.sync_affiliate_commission() from public, anon, authenticated;
revoke execute on function public.get_affiliate_dashboard() from public, anon;
grant execute on function public.get_affiliate_dashboard() to authenticated;
revoke execute on function public.request_affiliate_payout(int, text, text) from public, anon;
grant execute on function public.request_affiliate_payout(int, text, text) to authenticated;
revoke execute on function public.admin_resolve_affiliate_payout(text, boolean, text) from public, anon;
grant execute on function public.admin_resolve_affiliate_payout(text, boolean, text) to authenticated;
