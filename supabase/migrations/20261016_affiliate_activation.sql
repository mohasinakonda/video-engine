-- ════════════════════════════════════════════════════════════════════════════
-- Affiliate activation
--
-- A referral code only works (discount + commission) once its owner is an
-- active affiliate: they bought any subscription plan, or an admin turned it on.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists affiliate_enabled boolean not null default false;

-- Existing subscribers and admins start active.
update public.profiles p
   set affiliate_enabled = true
 where not p.affiliate_enabled
   and (
     p.role = 'admin'
     or exists (
       select 1 from public.payments pay
        where pay.user_id = p.id and pay.status = 'APPROVED' and pay.item_type = 'subscription'
     )
   );

-- Users may not switch it on themselves (admins / service role / triggers can).
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if current_user in ('service_role', 'postgres') or (auth.jwt()->>'role' = 'service_role') then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Unauthorized to modify user role directly';
  end if;
  if new.tier is distinct from old.tier then
    raise exception 'Unauthorized to modify subscription tier directly';
  end if;
  if new.credits_remaining is distinct from old.credits_remaining then
    raise exception 'Unauthorized to modify credits remaining balance directly';
  end if;
  if new.credits_used is distinct from old.credits_used then
    raise exception 'Unauthorized to modify credits used';
  end if;
  if new.total_spent_bdt is distinct from old.total_spent_bdt then
    raise exception 'Unauthorized to modify total spent';
  end if;
  if new.is_blocked is distinct from old.is_blocked then
    raise exception 'Unauthorized to modify block status';
  end if;
  if new.referral_code is distinct from old.referral_code then
    raise exception 'Unauthorized to modify referral code';
  end if;
  if new.referral_earnings_bdt is distinct from old.referral_earnings_bdt or
     new.referral_pending_bdt is distinct from old.referral_pending_bdt or
     new.referral_paid_bdt is distinct from old.referral_paid_bdt or
     new.referral_count is distinct from old.referral_count then
    raise exception 'Unauthorized to modify referral stats directly';
  end if;
  if new.affiliate_enabled is distinct from old.affiliate_enabled then
    raise exception 'Unauthorized to modify affiliate status directly';
  end if;
  if new.subscription_expires_at is distinct from old.subscription_expires_at then
    raise exception 'Unauthorized to modify subscription expiration directly';
  end if;

  return new;
end;
$$;

-- Only active affiliates' codes are valid (used by checkout validation on both client and server).
create or replace function public.lookup_influencer_rates(p_referral_code text)
returns table(id uuid, full_name text, email text, referral_code text, referral_count integer, discount_percent integer, commission_percent integer)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.referral_code,
    coalesce(p.referral_count, 0)::int,
    coalesce(p.referral_discount_percent, 20)::int,
    coalesce(p.referral_commission_percent, 15)::int
  from public.profiles p
  where upper(trim(p.referral_code)) = upper(trim(p_referral_code))
    and p.affiliate_enabled
  limit 1;
end;
$$;

-- Approved payment: activate the buyer's affiliate account (subscriptions only),
-- and record commission only for an active affiliate.
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
  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED'
     and new.item_type = 'subscription' and new.user_id is not null then
    update public.profiles
       set affiliate_enabled = true, updated_at = now()
     where id = new.user_id and not affiliate_enabled;
  end if;

  -- Payment approved: record the commission, on hold for 14 days.
  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED'
     and coalesce(trim(new.promo_code_applied), '') <> '' then
    select id, least(greatest(coalesce(referral_commission_percent, 15), 0), 50)
      into v_affiliate_id, v_percent
      from public.profiles
     where upper(referral_code) = upper(trim(new.promo_code_applied))
       and affiliate_enabled;

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

-- Dashboard: expose whether the program is active for this user.
create or replace function public.get_affiliate_dashboard()
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_enabled boolean;
  v_matured int;
  v_requested int;
  v_paid int;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(affiliate_enabled, false) into v_enabled from public.profiles where id = v_uid;

  select coalesce(sum(commission_bdt), 0) into v_matured
    from public.affiliate_commissions
   where affiliate_id = v_uid and status = 'ACTIVE' and available_at <= now();

  select coalesce(sum(amount_bdt) filter (where status = 'PENDING'), 0),
         coalesce(sum(amount_bdt) filter (where status = 'PAID'), 0)
    into v_requested, v_paid
    from public.affiliate_payouts
   where user_id = v_uid;

  select jsonb_build_object(
    'enabled', coalesce(v_enabled, false),
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

-- Payouts only for active affiliates (an admin can switch an abuser off).
create or replace function public.request_affiliate_payout(
  p_amount_bdt int,
  p_payment_method text,
  p_account_number text
)
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_enabled boolean;
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
  select email, affiliate_enabled into v_email, v_enabled from public.profiles where id = v_uid for update;

  if not coalesce(v_enabled, false) then
    return jsonb_build_object('ok', false, 'error', 'Your partner account is not active. Please contact support.');
  end if;

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
