-- Viral Engine: frame-by-frame Shorts analysis (docs/shorts-check-plan.md).
-- Admin settings only; the analysis itself stores nothing.
-- Off by default; admins can test it while it is off and set the price and limits in the admin panel.
alter table public.channel_doctor_settings
  add column if not exists viral_engine_enabled              boolean not null default false,
  add column if not exists viral_engine_credit_cost          int     not null default 10 check (viral_engine_credit_cost between 0 and 1000),
  add column if not exists viral_engine_runs_per_user_day    int     not null default 5  check (viral_engine_runs_per_user_day between 1 and 100),
  add column if not exists viral_engine_max_duration_sec     int     not null default 180 check (viral_engine_max_duration_sec between 15 and 180),
  add column if not exists viral_engine_max_body_frames      int     not null default 36 check (viral_engine_max_body_frames between 9 and 45),
  add column if not exists viral_engine_max_baseline_shorts  int     not null default 8  check (viral_engine_max_baseline_shorts between 0 and 15);
