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
