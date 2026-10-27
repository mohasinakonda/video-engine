-- Launch Kit competitor search limits (admin-controlled). Each search costs 100 YouTube quota
-- units from the shared daily search budget, so it gets a per-user limit and its own daily share.
alter table public.channel_doctor_settings
  add column if not exists launch_kit_searches_per_user_day integer not null default 5
    check (launch_kit_searches_per_user_day between 0 and 100),
  add column if not exists launch_kit_searches_per_day integer not null default 20
    check (launch_kit_searches_per_day between 0 and 100000);
