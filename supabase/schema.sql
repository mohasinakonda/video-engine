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

-- Row Level Security (RLS)
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Allow all operations for service role and admin" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
  on public.profiles for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Anti-tampering trigger: prevents standard users from escalating role, credits, tier, or affiliate funds
create or replace function public.protect_profile_fields()
returns trigger as $$
begin
  -- If service role or verified admin, permit changes
  if current_user = 'service_role' or (auth.jwt()->>'role' = 'service_role') then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
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
$$ language plpgsql security definer;

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
    30, -- 30 Free Credits to generate 1st video
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
  price_yearly int not null,
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
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed Default Plans
insert into public.plans (id, name, badge, popular, price_monthly, price_yearly, credits_per_month, max_video_duration_sec, max_resolution, features)
values
  ('STARTER', 'Starter', 'Popular for Beginners', false, 500, 5000, 200, 180, '1080p',
   '["200 Image Credits / month (~12-15 videos)", "Up to 3-minute video duration", "1080p Full HD rendering", "AI Script-to-Scenes Director", "Standard customer support"]'::jsonb),
  ('CREATOR', 'Creator', 'Most Popular', true, 1200, 12000, 600, 480, '1080p',
   '["600 Image Credits / month (~35-45 videos)", "Up to 8-minute video duration", "1080p Full HD rendering", "Custom visual art style presets", "Commercial usage license", "Priority WhatsApp support"]'::jsonb),
  ('STUDIO', 'Studio Pro', 'Full Power', false, 2500, 25000, 1500, 1200, '4k',
   '["1,500 Image Credits / month (~100+ videos)", "Up to 20-minute video duration", "4K Ultra HD crisp rendering", "VIP rendering speed queue", "Commercial usage license", "Direct WhatsApp VIP support"]'::jsonb)
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
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
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
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
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
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
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

alter table public.payments enable row level security;

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
  on public.payments for select
  using (
    auth.uid() = user_id or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Users can insert payments" on public.payments;
create policy "Users can insert payments"
  on public.payments for insert
  with check (auth.uid() = user_id or auth.uid() is null);

drop policy if exists "Allow all operations on payments" on public.payments;
drop policy if exists "Admins can update payments" on public.payments;
create policy "Admins can update payments"
  on public.payments for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
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
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
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
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
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
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
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
$$ language plpgsql security definer;

-- 2. Grant Credits
create or replace function public.grant_credits(p_user_id uuid, p_amount int)
returns void as $$
begin
  if p_amount <= 0 then
    return;
  end if;

  update public.profiles
  set
    credits_remaining = credits_remaining + p_amount,
    updated_at = now()
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- 3. Atomic Promo Code Counter
create or replace function public.increment_promo_usage(p_code text)
returns boolean as $$
declare
  v_code text := upper(trim(p_code));
  v_max_uses int;
  v_curr_uses int;
begin
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
$$ language plpgsql security definer;

-- 4. Atomic Affiliate Commission Crediting
create or replace function public.credit_affiliate_commission(
  p_referral_code text,
  p_order_amount_bdt int,
  p_commission_percent int default 15
)
returns boolean as $$
declare
  v_ref_owner uuid;
  v_commission int;
begin
  if p_order_amount_bdt <= 0 then
    return false;
  end if;

  select id into v_ref_owner
  from public.profiles
  where upper(referral_code) = upper(trim(p_referral_code));

  if not found then
    return false;
  end if;

  v_commission := round((p_order_amount_bdt * p_commission_percent) / 100.0);

  update public.profiles
  set
    referral_earnings_bdt = referral_earnings_bdt + v_commission,
    referral_pending_bdt = referral_pending_bdt + v_commission,
    referral_count = referral_count + 1,
    updated_at = now()
  where id = v_ref_owner;

  return true;
end;
$$ language plpgsql security definer;

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
  with check (bucket_id in ('scene-images', 'audio-voiceovers'));
