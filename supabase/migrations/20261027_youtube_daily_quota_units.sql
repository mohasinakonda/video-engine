-- The Google project's YouTube Data API daily quota (units), shown against usage on the admin
-- dashboard. Admin-controlled: raise it when Google approves a quota increase.
alter table public.channel_doctor_settings
  add column if not exists youtube_daily_quota_units integer not null default 10000
    check (youtube_daily_quota_units between 1 and 100000000);
