-- The Launch Kit's competitor search was removed, and "video ideas from a topic" was not kept,
-- so their settings columns are no longer read.
alter table public.channel_doctor_settings
  drop column if exists launch_kit_searches_per_user_day,
  drop column if exists launch_kit_searches_per_day,
  drop column if exists topic_ideas_credit_cost;
