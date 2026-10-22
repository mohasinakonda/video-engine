-- Audit (docs/audit-plan.md §7): admin settings on the shared settings row.
-- Audits store nothing else: other channels' data is processed in memory per request.
alter table public.channel_doctor_settings
  add column if not exists audit_enabled             boolean not null default false,
  add column if not exists video_audit_credit_cost   int     not null default 5  check (video_audit_credit_cost between 0 and 1000),
  add column if not exists channel_audit_credit_cost int     not null default 10 check (channel_audit_credit_cost between 0 and 1000),
  add column if not exists audit_runs_per_user_day   int     not null default 20 check (audit_runs_per_user_day between 1 and 500),
  add column if not exists audit_max_comments        int     not null default 100 check (audit_max_comments between 0 and 100),
  add column if not exists audit_max_thumbnails      int     not null default 8  check (audit_max_thumbnails between 0 and 20);
