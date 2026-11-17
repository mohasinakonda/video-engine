-- Affiliate Intelligence and Store (docs/affiliate-intelligence-plan.md).
-- Off by default; admins turn it on and set prices and limits in the admin panel.
-- Every plan except Trial by default. Products live in the separate store database.
alter table public.channel_doctor_settings
  add column if not exists affiliate_enabled               boolean not null default false,
  add column if not exists affiliate_allowed_plans         text[]  not null default '{STARTER,CREATOR,STUDIO}',
  add column if not exists affiliate_search_credit_cost    int     not null default 2  check (affiliate_search_credit_cost between 0 and 1000),
  add column if not exists affiliate_video_credit_cost     int     not null default 10 check (affiliate_video_credit_cost between 0 and 1000),
  add column if not exists affiliate_seo_credit_cost       int     not null default 5  check (affiliate_seo_credit_cost between 0 and 1000),
  add column if not exists affiliate_searches_per_user_day int     not null default 30 check (affiliate_searches_per_user_day between 1 and 500),
  add column if not exists affiliate_details_per_user_day  int     not null default 100 check (affiliate_details_per_user_day between 1 and 2000);
