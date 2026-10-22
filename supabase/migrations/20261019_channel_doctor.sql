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
