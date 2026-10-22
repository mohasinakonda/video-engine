-- Create: one price per video, charged when the project starts (docs/create-plan.md §20).
-- unlocked_at: when the video's price was paid (null for projects made before, which still pay per action).
-- usage: how many AI runs of each kind the project used, against the included allowances.
alter table public.video_projects
  add column if not exists unlocked_at timestamptz,
  add column if not exists usage jsonb not null default '{}'::jsonb;

alter table public.channel_doctor_settings
  add column if not exists bundle_credit_cost      int not null default 15 check (bundle_credit_cost between 0 and 1000),
  add column if not exists bundle_brief_drafts     int not null default 3  check (bundle_brief_drafts between 0 and 50),
  add column if not exists bundle_script_writes    int not null default 2  check (bundle_script_writes between 0 and 50),
  add column if not exists bundle_section_rewrites int not null default 20 check (bundle_section_rewrites between 0 and 200),
  add column if not exists bundle_packaging_runs   int not null default 3  check (bundle_packaging_runs between 0 and 50),
  add column if not exists bundle_topic_searches   int not null default 1  check (bundle_topic_searches between 0 and 20);
