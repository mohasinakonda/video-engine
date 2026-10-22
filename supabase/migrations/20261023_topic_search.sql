-- Topic search in the Create brief: who made videos on this topic and how they perform.
-- Admin-controlled price and limits; results are never stored.
alter table public.channel_doctor_settings
  add column if not exists topic_search_credit_cost       int not null default 3  check (topic_search_credit_cost between 0 and 1000),
  add column if not exists topic_searches_per_user_day    int not null default 3  check (topic_searches_per_user_day between 0 and 100),
  add column if not exists topic_search_baseline_channels int not null default 10 check (topic_search_baseline_channels between 0 and 20);
