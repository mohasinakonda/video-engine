-- Views check and Keyword check inside Channel Doctor (docs/views-check-plan.md).
-- Off by default; admins turn them on and set prices and limits in the admin panel.
alter table public.channel_doctor_settings
  add column if not exists views_check_enabled               boolean not null default false,
  add column if not exists views_check_credit_cost           int     not null default 10 check (views_check_credit_cost between 0 and 1000),
  add column if not exists views_check_runs_per_user_day     int     not null default 5  check (views_check_runs_per_user_day between 1 and 100),
  add column if not exists views_check_max_videos            int     not null default 30 check (views_check_max_videos between 5 and 50),
  add column if not exists views_check_max_deep_dives        int     not null default 10 check (views_check_max_deep_dives between 0 and 20),
  add column if not exists keyword_check_enabled             boolean not null default false,
  add column if not exists keyword_check_credit_cost         int     not null default 5  check (keyword_check_credit_cost between 0 and 1000),
  add column if not exists keyword_check_keywords_per_run    int     not null default 3  check (keyword_check_keywords_per_run between 1 and 5),
  add column if not exists keyword_check_runs_per_user_day   int     not null default 2  check (keyword_check_runs_per_user_day between 1 and 20);
