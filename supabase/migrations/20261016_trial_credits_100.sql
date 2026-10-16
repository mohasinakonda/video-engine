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
