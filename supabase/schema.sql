-- ==============================================================================
-- AI VIDEO STUDIO — SUPABASE COMPLETE DATABASE SCHEMA & MIGRATION (HARDENED)
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- PROFILES (Users, Credits, Subscription & Affiliate Data)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  tier text default 'TRIAL' check (tier in ('TRIAL', 'STARTER', 'CREATOR', 'STUDIO')),
  credits_remaining int default 30 not null check (credits_remaining >= 0),
  credits_used int default 0 not null,
  total_spent_bdt int default 0 not null,
  is_blocked boolean default false not null,
  block_reason text,
  referral_code text unique not null,
  referral_count int default 0 not null,
  referral_earnings_bdt int default 0 not null,
  referral_pending_bdt int default 0 not null,
  referral_paid_bdt int default 0 not null,
  assigned_promo_code text,
  role text default 'user' check (role in ('admin', 'user')) not null,
  subscription_expires_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Ensure column exists if table was created previously
alter table public.profiles add column if not exists subscription_expires_at timestamptz;

-- Security Definer function to check admin role without triggering RLS recursion
create or replace function public.is_admin()
returns boolean as $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();
  return coalesce(v_role = 'admin', false);
end;
$$ language plpgsql security definer set search_path = public;

-- True for the service role (server-side trusted code) or a verified admin user.
-- Used to gate privileged SECURITY DEFINER functions below.
create or replace function public.is_service_or_admin()
returns boolean as $$
begin
  return current_user = 'service_role'
    or coalesce(auth.jwt()->>'role', '') = 'service_role'
    or public.is_admin();
end;
$$ language plpgsql security definer set search_path = public;

-- Row Level Security (RLS)
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Allow all operations for service role and admin" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- Anti-tampering trigger: prevents standard users from escalating role, credits, tier, or affiliate funds
-- SECURITY INVOKER on purpose: in a SECURITY DEFINER function current_user is the
-- owner (postgres), which would make the bypass below match every caller.
create or replace function public.protect_profile_fields()
returns trigger as $$
begin
  -- Service role and trusted server-side code (SECURITY DEFINER RPCs owned by postgres) may change anything.
  if current_user in ('service_role', 'postgres', 'supabase_admin') or (auth.jwt()->>'role' = 'service_role') then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Regular user: block tampering with privileged fields
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
  if new.subscription_expires_at is distinct from old.subscription_expires_at then
    raise exception 'Unauthorized to modify subscription expiration directly';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_protect_profile_fields on public.profiles;
create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_fields();

-- ==============================================================================
-- AUTOMATIC NEW USER REGISTRATION TRIGGER
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_code text;
begin
  random_code := 'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    tier,
    credits_remaining,
    credits_used,
    total_spent_bdt,
    is_blocked,
    referral_code,
    created_at,
    updated_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Creator'),
    new.raw_user_meta_data->>'avatar_url',
    'TRIAL',
    100, -- free trial credits: enough to make one full video and try every feature
    0,
    0,
    false,
    random_code,
    now(),
    now()
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- SUBSCRIPTION PLANS (Dynamic Pricing & Quota Managed by Admin)
-- ==============================================================================
create table if not exists public.plans (
  id text primary key, -- 'STARTER', 'CREATOR', 'STUDIO'
  name text not null,
  badge text,
  popular boolean default false,
  price_monthly int not null,
  price_quarterly int,
  price_yearly int, -- legacy: yearly billing is discontinued
  credits_per_month int not null,
  max_video_duration_sec int not null,
  max_resolution text default '1080p',
  features jsonb not null,
  is_active boolean default true not null
);

alter table public.plans enable row level security;
drop policy if exists "Anyone can read active plans" on public.plans;
create policy "Anyone can read active plans" on public.plans for select using (true);

drop policy if exists "Allow upsert plans" on public.plans;
drop policy if exists "Admins can manage plans" on public.plans;
create policy "Admins can manage plans" on public.plans for all
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- Seed Default Plans
-- Mirrors production pricing (Starter = 1 BDT per credit; bigger plans are cheaper per credit).
alter table public.plans add column if not exists price_quarterly int;
alter table public.plans alter column price_yearly drop not null;

insert into public.plans (id, name, badge, popular, price_monthly, price_quarterly, credits_per_month, max_video_duration_sec, max_resolution, features)
values
  ('STARTER', 'Starter', 'Popular for Beginners', false, 1200, 3200, 1200, 180, '1080p',
   '["1,200 Credits / month", "YouTube Launch Kit & SEO Kit", "Up to 3-minute video duration per project", "1080p Full HD crisp rendering", "100% Watermark-Free Export", "Bangla & English AI Voiceovers included", "AI Script-to-Scenes Director", "Standard customer support"]'::jsonb),
  ('CREATOR', 'Creator', 'Most Popular', true, 1650, 4500, 2000, 600, '1080p',
   '["2,000 Credits / month", "Complete YouTube Launch Kit & SEO Director", "Up to 10-minute video duration per project", "1080p Full HD crisp rendering", "100% Watermark-Free Export", "Bangla & English AI Voiceovers included", "Custom visual styles & character consistency", "Commercial monetization license (YouTube & FB)", "Fast rendering priority queue", "Priority WhatsApp VIP support"]'::jsonb),
  ('STUDIO', 'Studio Pro', 'Full Power', false, 2500, 6800, 3500, 1200, '4k',
   '["3,500 Credits / month", "YouTube Launch Kit & SEO Director", "Up to 20-minute video duration", "4K Ultra HD pristine rendering", "100% Watermark-Free Export", "All AI Voiceovers & Audio FX included", "Instant VIP rendering queue", "Full commercial & agency monetization rights", "Dedicated 1-on-1 WhatsApp VIP manager"]'::jsonb)
on conflict (id) do nothing;

-- ==============================================================================
-- CREDIT TOP-UP PACKS
-- ==============================================================================
create table if not exists public.topup_packs (
  id text primary key,
  name text not null,
  credits int not null,
  price_bdt int not null,
  per_credit_bdt numeric(10,2) not null,
  popular boolean default false
);

alter table public.topup_packs enable row level security;
drop policy if exists "Anyone can read topup packs" on public.topup_packs;
create policy "Anyone can read topup packs" on public.topup_packs for select using (true);

drop policy if exists "Allow upsert topup packs" on public.topup_packs;
drop policy if exists "Admins can manage topup packs" on public.topup_packs;
create policy "Admins can manage topup packs" on public.topup_packs for all
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- Seed Default Topup Packs
insert into public.topup_packs (id, name, credits, price_bdt, per_credit_bdt, popular)
values
  ('topup_50', 'Quick Top-up', 50, 50, 1.00, false),
  ('topup_100', 'Standard Boost', 100, 100, 1.00, true),
  ('topup_250', 'Power Pack', 250, 200, 0.80, false)
on conflict (id) do nothing;

-- ==============================================================================
-- PROMO CODES & AFFILIATE DISCOUNTS
-- ==============================================================================
create table if not exists public.promo_codes (
  code text primary key,
  type text not null check (type in ('PERCENTAGE', 'FIXED', 'CREDIT_BONUS')),
  discount_value int not null,
  bonus_credits int default 0,
  valid_until timestamptz not null,
  max_uses int default 100,
  current_uses int default 0,
  description text,
  is_active boolean default true,
  owner_user_id uuid references auth.users(id),
  commission_percent int default 15
);

alter table public.promo_codes enable row level security;
drop policy if exists "Anyone can view active promo codes" on public.promo_codes;
create policy "Anyone can view active promo codes" on public.promo_codes for select using (true);

drop policy if exists "Allow upsert promo codes" on public.promo_codes;
drop policy if exists "Admins can manage promo codes" on public.promo_codes;
create policy "Admins can manage promo codes" on public.promo_codes for all
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- Seed Default Promo Codes
insert into public.promo_codes (code, type, discount_value, bonus_credits, valid_until, max_uses, current_uses, description, is_active, commission_percent)
values
  ('EARLY50', 'PERCENTAGE', 50, 0, now() + interval '30 days', 50, 0, 'Launch special: 50% flat discount for early adopters', true, 15),
  ('LAUNCH20', 'PERCENTAGE', 20, 0, now() + interval '60 days', 500, 0, '20% off on all monthly and yearly subscription plans', true, 15),
  ('FREE30', 'CREDIT_BONUS', 0, 30, now() + interval '90 days', 200, 0, 'Unlocks +30 free bonus credits for new creators', true, 0)
on conflict (code) do nothing;

-- ==============================================================================
-- MANUAL PAYMENT SUBMISSIONS (bKash / Nagad / Bank)
-- ==============================================================================
create table if not exists public.payments (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  plan_id text,
  topup_id text,
  item_type text not null check (item_type in ('subscription', 'topup')),
  billing_cycle text check (billing_cycle in ('monthly', 'quarterly')),
  original_price_bdt int not null,
  discounted_price_bdt int not null,
  promo_code_applied text,
  credits_to_grant int not null,
  payment_method text not null check (payment_method in ('bkash', 'nagad', 'bank')),
  sender_number text not null,
  trx_id text,
  status text default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at timestamptz default now() not null,
  reviewed_at timestamptz,
  admin_note text
);

alter table public.payments drop constraint if exists payments_billing_cycle_check;
alter table public.payments add constraint payments_billing_cycle_check
  check (billing_cycle in ('monthly', 'quarterly'));

alter table public.payments enable row level security;

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
  on public.payments for select
  using (
    auth.uid() = user_id or
    public.is_admin()
  );

drop policy if exists "Users can insert payments" on public.payments;
create policy "Users can insert payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Allow all operations on payments" on public.payments;
drop policy if exists "Admins can update payments" on public.payments;
create policy "Admins can update payments"
  on public.payments for update
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- Payment submission: callers may only file a request for themselves.
create or replace function public.submit_payment_request(
  p_id text, p_user_id uuid, p_user_email text, p_plan_id text, p_topup_id text,
  p_item_type text, p_billing_cycle text, p_original_price_bdt integer,
  p_discounted_price_bdt integer, p_promo_code_applied text, p_credits_to_grant integer,
  p_payment_method text, p_sender_number text, p_trx_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if p_user_id is distinct from auth.uid() and not public.is_service_or_admin() then
    raise exception 'Not allowed to submit a payment for another user';
  end if;

  insert into public.payments (
    id, user_id, user_email, plan_id, topup_id, item_type, billing_cycle,
    original_price_bdt, discounted_price_bdt, promo_code_applied, credits_to_grant,
    payment_method, sender_number, trx_id, status, submitted_at
  ) values (
    p_id, p_user_id, p_user_email, p_plan_id, p_topup_id, p_item_type, p_billing_cycle,
    p_original_price_bdt, p_discounted_price_bdt, p_promo_code_applied, p_credits_to_grant,
    p_payment_method, p_sender_number, p_trx_id, 'PENDING', now()
  );

  select row_to_json(p) into v_result from public.payments p where p.id = p_id;
  return v_result;
end;
$$;

-- Payment approval: admins / service role only (grants credits and plan tier).
create or replace function public.approve_payment_admin(
  p_submission_id text,
  p_admin_note text default 'Approved by admin'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_period interval;
begin
  if not public.is_service_or_admin() then
    raise exception 'Only admins can approve payments';
  end if;

  select * into v_sub from public.payments where id = p_submission_id;
  if not found then
    return false;
  end if;
  -- Never credit the same payment twice.
  if v_sub.status = 'APPROVED' then
    return false;
  end if;

  v_period := case when v_sub.billing_cycle = 'quarterly' then interval '90 days' else interval '30 days' end;

  update public.payments
  set status = 'APPROVED', reviewed_at = now(), admin_note = p_admin_note
  where id = p_submission_id;

  if v_sub.user_id is not null then
    update public.profiles
    set credits_remaining = coalesce(credits_remaining, 0) + coalesce(v_sub.credits_to_grant, 0),
        total_spent_bdt = coalesce(total_spent_bdt, 0) + coalesce(v_sub.discounted_price_bdt, 0),
        tier = case
          when v_sub.item_type = 'subscription' and v_sub.plan_id is not null then v_sub.plan_id
          else tier
        end,
        -- Renewals stack: early renewals never lose paid days.
        subscription_expires_at = case
          when v_sub.item_type = 'subscription'
            then greatest(now(), coalesce(subscription_expires_at, now())) + v_period
          else subscription_expires_at
        end,
        updated_at = now()
    where id = v_sub.user_id;
  end if;

  if v_sub.promo_code_applied is not null and v_sub.promo_code_applied <> '' then
    perform public.credit_affiliate_commission(
      v_sub.promo_code_applied,
      coalesce(v_sub.discounted_price_bdt, 0),
      15
    );
  end if;

  return true;
end;
$$;

revoke execute on function public.submit_payment_request(text, uuid, text, text, text, text, text, integer, integer, text, integer, text, text, text) from public, anon;
grant execute on function public.submit_payment_request(text, uuid, text, text, text, text, text, integer, integer, text, integer, text, text, text) to authenticated, service_role;
revoke execute on function public.approve_payment_admin(text, text) from public, anon;
grant execute on function public.approve_payment_admin(text, text) to authenticated, service_role;

-- ==============================================================================
-- PLAN EXPIRY: 24h grace, then TRIAL with 0 credits (plan + top-up share one balance)
-- ==============================================================================
create table if not exists public.credit_expirations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  tier_before text not null,
  credits_expired int not null,
  plan_expired_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.credit_expirations enable row level security;
drop policy if exists "Users can view own credit expirations" on public.credit_expirations;
create policy "Users can view own credit expirations"
  on public.credit_expirations for select
  using (auth.uid() = user_id or public.is_admin());

create or replace function public.expire_lapsed_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with lapsed as (
    select id, tier, credits_remaining, subscription_expires_at
    from public.profiles
    where tier <> 'TRIAL'
      and subscription_expires_at is not null
      and subscription_expires_at < now() - interval '24 hours'
    for update
  ), logged as (
    insert into public.credit_expirations (user_id, tier_before, credits_expired, plan_expired_at)
    select id, tier, credits_remaining, subscription_expires_at from lapsed
  )
  update public.profiles p
  set tier = 'TRIAL',
      credits_remaining = 0,
      subscription_expires_at = null,
      updated_at = now()
  from lapsed
  where p.id = lapsed.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_lapsed_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_lapsed_subscriptions() to service_role;

-- Hourly job (requires the pg_cron extension).
create extension if not exists pg_cron;
select cron.schedule(
  'expire-lapsed-subscriptions',
  '5 * * * *',
  $cron$select public.expire_lapsed_subscriptions()$cron$
);

-- ==============================================================================
-- AFFILIATE PAYOUT REQUESTS
-- ==============================================================================
create table if not exists public.affiliate_payouts (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  amount_bdt int not null check (amount_bdt >= 100),
  payment_method text not null check (payment_method in ('bkash', 'nagad', 'bank')),
  account_number text not null,
  status text default 'PENDING' check (status in ('PENDING', 'PAID', 'REJECTED')),
  requested_at timestamptz default now() not null,
  paid_at timestamptz,
  note text
);

alter table public.affiliate_payouts enable row level security;

drop policy if exists "Users can view own payouts" on public.affiliate_payouts;
create policy "Users can view own payouts"
  on public.affiliate_payouts for select
  using (
    auth.uid() = user_id or
    public.is_admin()
  );

drop policy if exists "Users can submit payouts" on public.affiliate_payouts;
create policy "Users can submit payouts"
  on public.affiliate_payouts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Allow all operations on affiliate payouts" on public.affiliate_payouts;
drop policy if exists "Admins can manage affiliate payouts" on public.affiliate_payouts;
create policy "Admins can manage affiliate payouts"
  on public.affiliate_payouts for update
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- ==============================================================================
-- ADMIN SETTINGS & ANNOUNCEMENT BANNER
-- ==============================================================================
create table if not exists public.admin_settings (
  id int primary key default 1,
  whatsapp_number text not null,
  bkash_number text not null,
  nagad_number text not null,
  bank_details text not null,
  global_discount_percent int default 0,
  global_discount_active boolean default false,
  global_banner_text text default '🎉 Launch Celebration: Get 50 Free Image Credits on any subscription plan!',
  global_banner_active boolean default true
);

alter table public.admin_settings enable row level security;
drop policy if exists "Anyone can read admin settings" on public.admin_settings;
create policy "Anyone can read admin settings" on public.admin_settings for select using (true);

drop policy if exists "Allow upsert admin settings" on public.admin_settings;
drop policy if exists "Admins can manage admin settings" on public.admin_settings;
create policy "Admins can manage admin settings"
  on public.admin_settings for all
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

insert into public.admin_settings (id, whatsapp_number, bkash_number, nagad_number, bank_details, global_discount_percent, global_discount_active, global_banner_text, global_banner_active)
values
  (1, '01315055532', '01617420663', '01617420663', 'City Bank PLC | Hazrat AI Studio | A/C: 1503204928001 | Dhanmondi Branch', 0, false, '🎉 Launch Celebration: Get 50 Free Image Credits on any subscription plan!', true)
on conflict (id) do nothing;

-- ==============================================================================
-- ATOMIC STORED PROCEDURES (Anti-Abuse Credit Deduction, Grant, Promo, Affiliate)
-- ==============================================================================

-- 1. Atomic Credit Deduction (Checks balance and decrements in single transaction)
create or replace function public.deduct_credits(p_user_id uuid, p_amount int)
returns boolean as $$
declare
  current_balance int;
  user_blocked boolean;
begin
  if p_amount <= 0 then
    return false;
  end if;

  -- A user may only spend their own credits; service role / admin may act on anyone.
  if not (public.is_service_or_admin() or auth.uid() = p_user_id) then
    return false;
  end if;

  select credits_remaining, is_blocked into current_balance, user_blocked
  from public.profiles where id = p_user_id for update;

  if user_blocked or current_balance is null or current_balance < p_amount then
    return false;
  end if;

  update public.profiles
  set
    credits_remaining = credits_remaining - p_amount,
    credits_used = credits_used + p_amount,
    updated_at = now()
  where id = p_user_id;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- 2. Grant Credits
create or replace function public.grant_credits(p_user_id uuid, p_amount int)
returns void as $$
begin
  if p_amount <= 0 then
    return;
  end if;

  -- Granting credits is privileged: never callable by a regular user for themselves.
  if not public.is_service_or_admin() then
    raise exception 'Not authorized to grant credits';
  end if;

  update public.profiles
  set
    credits_remaining = credits_remaining + p_amount,
    updated_at = now()
  where id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 3. Atomic Promo Code Counter
create or replace function public.increment_promo_usage(p_code text)
returns boolean as $$
declare
  v_code text := upper(trim(p_code));
  v_max_uses int;
  v_curr_uses int;
begin
  if not public.is_service_or_admin() then
    raise exception 'Not authorized to modify promo usage';
  end if;

  select max_uses, current_uses into v_max_uses, v_curr_uses
  from public.promo_codes
  where upper(code) = v_code for update;

  if not found then
    return false;
  end if;

  if v_max_uses > 0 and v_curr_uses >= v_max_uses then
    return false;
  end if;

  update public.promo_codes
  set current_uses = current_uses + 1
  where upper(code) = v_code;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- 4. Atomic Affiliate Commission Crediting
create or replace function public.credit_affiliate_commission(
  p_referral_code text,
  p_order_amount_bdt int,
  p_commission_percent int default 15
)
returns boolean as $$
declare
  v_ref_owner uuid;
  v_percent int;
  v_commission int;
begin
  if not public.is_service_or_admin() then
    raise exception 'Not authorized to credit affiliate commission';
  end if;

  if p_order_amount_bdt <= 0 then
    return false;
  end if;

  -- The affiliate's own rate (set per user in admin) wins over the caller's default.
  select id, coalesce(referral_commission_percent, p_commission_percent)
  into v_ref_owner, v_percent
  from public.profiles
  where upper(referral_code) = upper(trim(p_referral_code));

  if not found or v_ref_owner is null or v_percent < 0 or v_percent > 50 then
    return false;
  end if;

  v_commission := round((p_order_amount_bdt * v_percent)::numeric / 100.0);

  update public.profiles
  set
    affiliate_earnings_bdt = coalesce(affiliate_earnings_bdt, 0) + v_commission,
    referral_earnings_bdt = coalesce(referral_earnings_bdt, 0) + v_commission,
    referral_pending_bdt = coalesce(referral_pending_bdt, 0) + v_commission,
    referral_count = coalesce(referral_count, 0) + 1,
    updated_at = now()
  where id = v_ref_owner;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- Lock down who may call the privileged functions (Postgres grants EXECUTE to PUBLIC by default).
revoke execute on function public.grant_credits(uuid, int) from public, anon;
revoke execute on function public.deduct_credits(uuid, int) from public, anon;
revoke execute on function public.increment_promo_usage(text) from public, anon;
revoke execute on function public.credit_affiliate_commission(text, int, int) from public, anon;
revoke execute on function public.is_service_or_admin() from public, anon;
grant execute on function public.grant_credits(uuid, int) to authenticated, service_role;
grant execute on function public.deduct_credits(uuid, int) to authenticated, service_role;
grant execute on function public.increment_promo_usage(text) to authenticated, service_role;
grant execute on function public.credit_affiliate_commission(text, int, int) to authenticated, service_role;

-- ==============================================================================
-- STORAGE BUCKETS (Audio Voiceovers & Generated Scene Images)
-- ==============================================================================
insert into storage.buckets (id, name, public)
values
  ('audio-voiceovers', 'audio-voiceovers', true),
  ('scene-images', 'scene-images', true)
on conflict (id) do update set public = true;

-- Public Storage Access Policies
drop policy if exists "Public Access to Scene Images" on storage.objects;
create policy "Public Access to Scene Images"
  on storage.objects for select
  using (bucket_id = 'scene-images');

drop policy if exists "Public Access to Audio Voiceovers" on storage.objects;
create policy "Public Access to Audio Voiceovers"
  on storage.objects for select
  using (bucket_id = 'audio-voiceovers');

drop policy if exists "Authenticated users can upload images" on storage.objects;
create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check (
    bucket_id in ('scene-images', 'audio-voiceovers')
    and auth.role() = 'authenticated'
  );

-- ==============================================================================
-- ART STYLES & PRESETS (Dynamic Catalog Managed by Admin)
-- ==============================================================================
create table if not exists public.art_styles (
  id text primary key,
  name text not null,
  family_id text not null,
  tag text,
  description text,
  style_prompt text not null,
  negative_prompt text,
  thumbnail_url text,
  aspect_ratio text default '16:9' not null,
  is_default boolean default false not null,
  is_active boolean default true not null,
  sort_order int default 100 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_art_styles_family on public.art_styles(family_id);
create index if not exists idx_art_styles_active on public.art_styles(is_active);
create index if not exists idx_art_styles_sort on public.art_styles(sort_order);

alter table public.art_styles enable row level security;

-- Public can read all active styles
drop policy if exists "Anyone can read active art styles" on public.art_styles;
create policy "Anyone can read active art styles" 
  on public.art_styles for select 
  using (is_active = true);

-- Admins have full management access
drop policy if exists "Admins can manage art styles" on public.art_styles;
create policy "Admins can manage art styles" 
  on public.art_styles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- AI IMAGE MODELS (Dynamic DeepInfra Catalog Managed by Admin)
-- ==============================================================================
create table if not exists public.ai_models (
  id text primary key,
  name text not null,
  model_id text not null,
  provider text default 'deepinfra' not null,
  description text,
  credit_cost int default 2 not null check (credit_cost >= 0),
  allowed_plans text[] default array['CREATOR', 'STUDIO']::text[] not null,
  inference_steps int default 4,
  guidance_scale numeric default 1.0,
  is_default boolean default false not null,
  is_active boolean default true not null,
  sort_order int default 10 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_ai_models_active on public.ai_models(is_active);
create index if not exists idx_ai_models_sort on public.ai_models(sort_order);

alter table public.ai_models enable row level security;

-- Public can read all active models
drop policy if exists "Anyone can read active ai models" on public.ai_models;
create policy "Anyone can read active ai models" 
  on public.ai_models for select 
  using (is_active = true);

-- Admins have full management access
drop policy if exists "Admins can manage ai models" on public.ai_models;
create policy "Admins can manage ai models" 
  on public.ai_models for all
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- VOICE PRESETS (Curated Personas & Delivery Styles Managed by Admin)
-- ==============================================================================
create table if not exists public.voice_presets (
  id text primary key,
  name text not null,
  description text,
  language text not null default 'English',
  language_id text not null default 'en',
  gender text default 'neutral',
  tags text[] default array['narration']::text[] not null,
  exaggeration numeric default 0.5 not null check (exaggeration >= 0 and exaggeration <= 1),
  sample_audio_url text,
  is_default boolean default false not null,
  is_active boolean default true not null,
  sort_order int default 10 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_voice_presets_active on public.voice_presets(is_active);
create index if not exists idx_voice_presets_sort on public.voice_presets(sort_order);

alter table public.voice_presets enable row level security;

-- Public can read all active presets
create policy "Anyone can read active voice presets"
  on public.voice_presets for select
  using (is_active = true);

-- Admins have full management access
create policy "Admins can manage voice presets"
  on public.voice_presets for all
  using (public.is_admin())
  with check (public.is_admin());

-- ==============================================================================
-- USER CUSTOM VOICES (Personal Voice Designs & Clones per User)
-- ==============================================================================
create table if not exists public.user_custom_voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  deepinfra_voice_id text not null,
  voice_prompt text,
  sample_audio_url text,
  gender text default 'neutral',
  language text default 'English',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_user_custom_voices_user on public.user_custom_voices(user_id);
alter table public.user_custom_voices enable row level security;

drop policy if exists "Users can manage their own custom voices" on public.user_custom_voices;
create policy "Users can manage their own custom voices"
  on public.user_custom_voices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);



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

-- New users get 100 free trial credits (was 30): enough for one full video plus the
-- YouTube Launch Kit, so they can try every feature before paying.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  random_code text;
begin
  random_code := 'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.profiles (
    id, email, full_name, avatar_url, tier,
    credits_remaining, credits_used, total_spent_bdt, is_blocked,
    referral_code, created_at, updated_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Creator'),
    new.raw_user_meta_data->>'avatar_url',
    'TRIAL',
    100, -- free trial credits: enough to make one full video and try every feature
    0,
    0,
    false,
    random_code,
    now(),
    now()
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_missing_profiles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count int;
begin
  insert into public.profiles (
    id, email, full_name, avatar_url, tier,
    credits_remaining, credits_used, total_spent_bdt, is_blocked,
    referral_code, created_at, updated_at
  )
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Creator'),
    u.raw_user_meta_data->>'avatar_url',
    'TRIAL',
    100,
    0,
    0,
    false,
    'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6)),
    u.created_at,
    now()
  from auth.users u
  left join public.profiles p on u.id = p.id
  where p.id is null
  on conflict (id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- Trigger function: never needs to be called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_missing_profiles() from public, anon;

-- Free trial credits are now an admin-panel setting (Plans & Settings page):
-- admin_settings.trial_enabled + trial_credits. New accounts read it at sign-up.

alter table public.admin_settings add column if not exists trial_credits int not null default 100;
alter table public.admin_settings add column if not exists trial_enabled boolean not null default true;

create or replace function public.current_trial_credits()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when trial_enabled then greatest(trial_credits, 0) else 0 end
       from public.admin_settings where id = 1),
    100
  );
$$;

revoke execute on function public.current_trial_credits() from public, anon, authenticated;

-- New accounts start with the configured amount.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  random_code text;
begin
  random_code := 'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.profiles (
    id, email, full_name, avatar_url, tier,
    credits_remaining, credits_used, total_spent_bdt, is_blocked,
    referral_code, created_at, updated_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Creator'),
    new.raw_user_meta_data->>'avatar_url',
    'TRIAL',
    public.current_trial_credits(),
    0,
    0,
    false,
    random_code,
    now(),
    now()
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_missing_profiles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count int;
begin
  insert into public.profiles (
    id, email, full_name, avatar_url, tier,
    credits_remaining, credits_used, total_spent_bdt, is_blocked,
    referral_code, created_at, updated_at
  )
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Creator'),
    u.raw_user_meta_data->>'avatar_url',
    'TRIAL',
    public.current_trial_credits(),
    0,
    0,
    false,
    'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6)),
    u.created_at,
    now()
  from auth.users u
  left join public.profiles p on u.id = p.id
  where p.id is null
  on conflict (id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- Trigger function: never needs to be called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_missing_profiles() from public, anon;
-- Plan changes on approval:
--  * renewing the same, still-active plan stacks onto the paid days;
--  * a new plan (upgrade, or buying after the plan lapsed) starts a fresh period today,
--    so the leftover days of a cheaper plan are not turned into days of a dearer one.
-- Credits always carry over. Downgrades are blocked in /api/payments while a plan is active.
create or replace function public.approve_payment_admin(p_submission_id text, p_admin_note text default 'Approved by admin'::text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sub record;
  v_period interval;
begin
  if not public.is_service_or_admin() then
    raise exception 'Only admins can approve payments';
  end if;

  select * into v_sub from public.payments where id = p_submission_id;
  if not found then
    return false;
  end if;
  -- Never credit the same payment twice.
  if v_sub.status = 'APPROVED' then
    return false;
  end if;

  v_period := case when v_sub.billing_cycle = 'quarterly' then interval '90 days' else interval '30 days' end;

  update public.payments
  set status = 'APPROVED', reviewed_at = now(), admin_note = p_admin_note
  where id = p_submission_id;

  if v_sub.user_id is not null then
    -- SET expressions read the row as it was before this update.
    update public.profiles
    set credits_remaining = coalesce(credits_remaining, 0) + coalesce(v_sub.credits_to_grant, 0),
        total_spent_bdt = coalesce(total_spent_bdt, 0) + coalesce(v_sub.discounted_price_bdt, 0),
        tier = case
          when v_sub.item_type = 'subscription' and v_sub.plan_id is not null then v_sub.plan_id
          else tier
        end,
        subscription_expires_at = case
          when v_sub.item_type <> 'subscription' then subscription_expires_at
          when v_sub.plan_id = tier and subscription_expires_at > now() then subscription_expires_at + v_period
          else now() + v_period
        end,
        updated_at = now()
    where id = v_sub.user_id;
  end if;

  if v_sub.promo_code_applied is not null and v_sub.promo_code_applied <> '' then
    perform public.credit_affiliate_commission(
      v_sub.promo_code_applied,
      coalesce(v_sub.discounted_price_bdt, 0),
      15
    );
  end if;

  return true;
end;
$function$;

-- Channel Doctor (YouTube channel diagnosis), Phase 1.
-- Only the YouTube connection and the admin configuration are stored.
-- Channel analytics, reports and AI output are never written to the database.

-- One YouTube connection per app user. Tokens are encrypted by the app (AES-256-GCM)
-- with a key that lives in the server environment, not in the database.
create table if not exists public.youtube_connections (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  channel_id               text not null,
  channel_title            text,
  channel_thumbnail        text,
  access_token_enc         text,
  refresh_token_enc        text,
  token_expires_at         timestamptz,
  scopes                   text[] not null default '{}',
  status                   text not null default 'active'
                           check (status in ('active', 'needs_reauth', 'revoked')),
  reporting_job_id         text,
  reporting_job_created_at timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- RLS on with no policies: only the server's service-role client can read or write,
-- always filtered by the signed-in user's id. Token columns never reach the browser.
alter table public.youtube_connections enable row level security;

-- Admin-controlled settings (single row).
create table if not exists public.channel_doctor_settings (
  id                         int primary key default 1 check (id = 1),
  enabled                    boolean not null default true,
  allowed_plans              text[]  not null default '{STARTER,CREATOR,STUDIO}',
  diagnosis_credit_cost      int     not null default 10 check (diagnosis_credit_cost >= 0),
  video_analysis_credit_cost int     not null default 3  check (video_analysis_credit_cost >= 0),
  text_models                text[]  not null default '{deepseek-ai/DeepSeek-V4-Flash-0731,nvidia/NVIDIA-Nemotron-3.5-Lightning}',
  vision_models              text[]  not null default '{Qwen/Qwen3-VL-30B-A3B-Instruct,google/gemma-3-27b-it}',
  max_videos                 int     not null default 100 check (max_videos between 10 and 200),
  max_retention_videos       int     not null default 8   check (max_retention_videos between 0 and 20),
  max_thumbnails             int     not null default 12  check (max_thumbnails between 0 and 24),
  hourly_limit_per_user      int     not null default 10  check (hourly_limit_per_user between 1 and 100),
  updated_at                 timestamptz not null default now()
);

insert into public.channel_doctor_settings (id) values (1) on conflict (id) do nothing;

alter table public.channel_doctor_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'channel_doctor_settings'
      and policyname = 'Admins manage channel doctor settings'
  ) then
    create policy "Admins manage channel doctor settings" on public.channel_doctor_settings
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Discover (Phase 2): competitor watchlist, shared YouTube search budget, admin settings.
-- Only user configuration and counters are stored. No competitor titles, stats,
-- thumbnails, search results or reports (see docs/discover-plan.md §3).

-- ─── Competitor watchlist ────────────────────────────────────────────────────
create table if not exists public.discover_competitors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  channel_id  text not null check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  label       text check (label is null or char_length(label) <= 60),
  grouping    text not null default 'direct' check (grouping in ('direct', 'adjacent', 'format')),
  active      boolean not null default true,
  added_at    timestamptz not null default now(),
  unique (user_id, channel_id)
);

create index if not exists discover_competitors_user_idx on public.discover_competitors (user_id);

alter table public.discover_competitors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'discover_competitors' and policyname = 'Users manage own competitors'
  ) then
    create policy "Users manage own competitors" on public.discover_competitors
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ─── Shared YouTube quota budget (search.list has its own 100 calls/day bucket) ──
create table if not exists public.youtube_quota_usage (
  day     date not null,
  bucket  text not null check (char_length(bucket) <= 80),
  used    integer not null default 0 check (used >= 0),
  primary key (day, bucket)
);

-- Service role only: RLS on, no policies.
alter table public.youtube_quota_usage enable row level security;

-- Atomically adds p_amount to today's (Pacific time) counter unless that would pass p_limit.
-- Returns true when the amount was reserved. Rows are tiny (one per day per bucket);
-- old days can be pruned manually if the table ever grows.
create or replace function public.consume_youtube_quota(p_bucket text, p_amount int, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
  v_used int;
begin
  if p_amount <= 0 then
    return true;
  end if;
  if p_amount > p_limit then
    return false;
  end if;

  -- On conflict the WHERE skips the update when the limit would be passed, so nothing is returned.
  insert into public.youtube_quota_usage as q (day, bucket, used)
  values (v_day, p_bucket, p_amount)
  on conflict (day, bucket) do update
    set used = q.used + excluded.used
    where q.used + excluded.used <= p_limit
  returning used into v_used;

  return v_used is not null;
end;
$$;

revoke all on function public.consume_youtube_quota(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_youtube_quota(text, int, int) to service_role;

-- ─── Admin settings for Discover (same single-row table as Channel Doctor) ────
alter table public.channel_doctor_settings
  add column if not exists discover_enabled             boolean not null default false,
  add column if not exists discover_allowed_plans       text[]  not null default '{CREATOR,STUDIO}',
  add column if not exists discovery_credit_cost        int     not null default 5  check (discovery_credit_cost between 0 and 1000),
  add column if not exists research_credit_cost         int     not null default 15 check (research_credit_cost between 0 and 1000),
  add column if not exists opportunity_credit_cost      int     not null default 3  check (opportunity_credit_cost between 0 and 1000),
  add column if not exists max_competitors              int     not null default 10 check (max_competitors between 1 and 25),
  add column if not exists videos_per_competitor        int     not null default 50 check (videos_per_competitor between 15 and 100),
  add column if not exists search_calls_per_discovery   int     not null default 3  check (search_calls_per_discovery between 1 and 5),
  add column if not exists search_daily_global_limit    int     not null default 80 check (search_daily_global_limit between 0 and 100000),
  add column if not exists discovery_runs_per_user_day  int     not null default 2  check (discovery_runs_per_user_day between 0 and 50),
  add column if not exists embedding_models             text[]  not null default '{BAAI/bge-m3,Qwen/Qwen3-Embedding-0.6B}',
  add column if not exists max_competitor_thumbnails    int     not null default 10 check (max_competitor_thumbnails between 0 and 30),
  add column if not exists opportunity_weights          jsonb   not null default
    '{"channelFit":25,"competitorPerformance":20,"momentum":15,"contentGap":15,"competition":10,"productionFit":10,"phase1":5}';

-- Create (Phase 3): video projects, published-video links, derived learning records and admin settings.
-- Stores user-owned content (brief, script, packaging) and relationships only. No raw analytics,
-- competitor data, prompts or media (see docs/create-plan.md §2).

-- ─── Video projects ──────────────────────────────────────────────────────────
create table if not exists public.video_projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  origin            text not null check (origin in ('opportunity', 'manual')),
  status            text not null default 'DRAFT' check (status in (
                      'DRAFT', 'BRIEF_READY', 'SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION',
                      'PUBLISHED', 'ANALYZING', 'LEARNED', 'ARCHIVED')),
  -- Status to return to when un-archiving.
  archived_from     text,
  last_error        jsonb,
  title             text not null check (char_length(title) between 1 and 200),
  thesis            jsonb,
  brief             jsonb,
  script            jsonb,
  packaging         jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists video_projects_user_idx on public.video_projects (user_id, updated_at desc);
alter table public.video_projects enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'video_projects' and policyname = 'Users read own video projects') then
    -- Read-only for users: every write goes through the server, which enforces the state machine.
    create policy "Users read own video projects" on public.video_projects
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── Project ↔ YouTube video link ────────────────────────────────────────────
create table if not exists public.published_videos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_id        uuid not null references public.video_projects(id) on delete cascade,
  youtube_video_id  text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  channel_id        text not null check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  published_at      timestamptz not null,
  link_method       text not null check (link_method in ('suggested', 'picked', 'pasted')),
  status            text not null default 'tracking' check (status in ('waiting_public', 'tracking', 'complete', 'unavailable')),
  created_at        timestamptz not null default now(),
  unique (user_id, youtube_video_id),
  unique (project_id)
);

create index if not exists published_videos_user_idx on public.published_videos (user_id);
alter table public.published_videos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'published_videos' and policyname = 'Users read own published videos') then
    -- Read-only for users: links are created by the server after checking the video is theirs.
    create policy "Users read own published videos" on public.published_videos
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── Derived learning metadata (labels, not statistics) ──────────────────────
create table if not exists public.learning_records (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  published_video_id     uuid not null references public.published_videos(id) on delete cascade,
  checkpoint_days        int  not null check (checkpoint_days between 1 and 90),
  topic_label            text check (topic_label is null or char_length(topic_label) <= 120),
  content_format         text,
  title_mechanism        text,
  thumbnail_mechanism    text,
  gap_types              text[] not null default '{}',
  opportunity_confidence text check (opportunity_confidence is null or opportunity_confidence in ('low', 'medium', 'high')),
  views_vs_baseline      text not null check (views_vs_baseline in ('well_above', 'above', 'typical', 'below', 'well_below', 'unknown')),
  ctr_vs_baseline        text check (ctr_vs_baseline is null or ctr_vs_baseline in ('above', 'typical', 'below', 'unknown')),
  retention_vs_baseline  text check (retention_vs_baseline is null or retention_vs_baseline in ('above', 'typical', 'below', 'unknown')),
  bottleneck             text not null check (bottleneck in ('none', 'discovery', 'packaging', 'retention', 'content_market_mismatch', 'execution', 'insufficient_data')),
  thesis_verdict         text not null check (thesis_verdict in ('supported', 'partly_supported', 'not_supported', 'inconclusive')),
  baseline_sample        int check (baseline_sample is null or baseline_sample >= 0),
  confidence             text not null check (confidence in ('low', 'medium', 'high')),
  created_at             timestamptz not null default now(),
  unique (published_video_id, checkpoint_days)
);

create index if not exists learning_records_user_idx on public.learning_records (user_id);
alter table public.learning_records enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_records' and policyname = 'Users read own learning records') then
    -- Learning records are written by the server (service role) from measured outcomes; users only read them.
    create policy "Users read own learning records" on public.learning_records
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── Admin settings for Create (same single-row table) ───────────────────────
alter table public.channel_doctor_settings
  add column if not exists create_enabled           boolean not null default false,
  add column if not exists create_allowed_plans     text[]  not null default '{CREATOR,STUDIO}',
  add column if not exists brief_credit_cost        int     not null default 2 check (brief_credit_cost between 0 and 1000),
  add column if not exists script_credit_cost       int     not null default 5 check (script_credit_cost between 0 and 1000),
  add column if not exists packaging_credit_cost    int     not null default 5 check (packaging_credit_cost between 0 and 1000),
  add column if not exists performance_credit_cost  int     not null default 2 check (performance_credit_cost between 0 and 1000),
  add column if not exists checkpoint_days          int[]   not null default '{1,2,7,28}',
  add column if not exists learning_min_videos      int     not null default 3 check (learning_min_videos between 2 and 50),
  add column if not exists max_projects_per_user    int     not null default 100 check (max_projects_per_user between 1 and 10000);
-- Audit (docs/audit-plan.md §7): admin settings on the shared settings row.
-- Audits store nothing else: other channels' data is processed in memory per request.
alter table public.channel_doctor_settings
  add column if not exists audit_enabled             boolean not null default false,
  add column if not exists video_audit_credit_cost   int     not null default 5  check (video_audit_credit_cost between 0 and 1000),
  add column if not exists channel_audit_credit_cost int     not null default 10 check (channel_audit_credit_cost between 0 and 1000),
  add column if not exists audit_runs_per_user_day   int     not null default 20 check (audit_runs_per_user_day between 1 and 500),
  add column if not exists audit_max_comments        int     not null default 100 check (audit_max_comments between 0 and 100),
  add column if not exists audit_max_thumbnails      int     not null default 8  check (audit_max_thumbnails between 0 and 20);
-- Topic search in the Create brief: who made videos on this topic and how they perform.
-- Admin-controlled price and limits; results are never stored.
alter table public.channel_doctor_settings
  add column if not exists topic_search_credit_cost       int not null default 3  check (topic_search_credit_cost between 0 and 1000),
  add column if not exists topic_searches_per_user_day    int not null default 3  check (topic_searches_per_user_day between 0 and 100),
  add column if not exists topic_search_baseline_channels int not null default 10 check (topic_search_baseline_channels between 0 and 20);
-- Create: one price per video, charged when the project starts (docs/create-plan.md §20).
-- unlocked_at: when the video's price was paid (null for projects made before, which still pay per action).
-- usage: how many AI runs of each kind the project used, against the included allowances.
alter table public.video_projects
  add column if not exists unlocked_at timestamptz,
  add column if not exists usage jsonb not null default '{}'::jsonb;

alter table public.channel_doctor_settings
  add column if not exists bundle_credit_cost      int not null default 15 check (bundle_credit_cost between 0 and 1000),
  add column if not exists bundle_brief_drafts     int not null default 3  check (bundle_brief_drafts between 0 and 50),
  add column if not exists bundle_script_writes    int not null default 2  check (bundle_script_writes between 0 and 50),
  add column if not exists bundle_section_rewrites int not null default 20 check (bundle_section_rewrites between 0 and 200),
  add column if not exists bundle_packaging_runs   int not null default 3  check (bundle_packaging_runs between 0 and 50),
  add column if not exists bundle_topic_searches   int not null default 1  check (bundle_topic_searches between 0 and 20);
