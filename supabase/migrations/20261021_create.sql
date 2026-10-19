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
