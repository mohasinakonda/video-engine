-- Views check: allow looking at up to 50 videos in depth (was 20), so every Short in the list gets
-- its per-day views, traffic and retention. These are YouTube Analytics calls, not Data API units.
alter table public.channel_doctor_settings
  drop constraint if exists channel_doctor_settings_views_check_max_deep_dives_check;
alter table public.channel_doctor_settings
  add constraint channel_doctor_settings_views_check_max_deep_dives_check check (views_check_max_deep_dives between 0 and 50),
  alter column views_check_max_deep_dives set default 30;
