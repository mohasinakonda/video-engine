-- Create: the Publish and Measure steps are removed, with the Learn page and Discover's track record.
-- Projects now end at PACKAGED. Apply after the code that no longer uses these tables is deployed.

-- Projects past packaging (and archived ones that will restore there) go back to PACKAGED.
update public.video_projects
  set status = 'PACKAGED', updated_at = now()
  where status in ('IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED');
update public.video_projects
  set archived_from = 'PACKAGED'
  where archived_from in ('IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED');

alter table public.video_projects drop constraint if exists video_projects_status_check;
alter table public.video_projects add constraint video_projects_status_check
  check (status in ('DRAFT', 'BRIEF_READY', 'SCRIPT_READY', 'PACKAGED', 'ARCHIVED'));

-- Video links and the learning labels measured from them.
drop table if exists public.learning_records;
drop table if exists public.published_videos;

-- Measuring settings, and the track record's share of the opportunity score.
alter table public.channel_doctor_settings
  drop column if exists performance_credit_cost,
  drop column if exists checkpoint_days,
  drop column if exists learning_min_videos;

update public.channel_doctor_settings
  set opportunity_weights = opportunity_weights - 'trackRecord'
      || case
           when opportunity_weights = '{"channelFit":20,"competitorPerformance":15,"momentum":15,"contentGap":15,"competition":10,"productionFit":10,"phase1":5,"trackRecord":10}'::jsonb
             then '{"channelFit":25,"competitorPerformance":20}'::jsonb
           else jsonb_build_object('channelFit', (opportunity_weights->>'channelFit')::int + coalesce((opportunity_weights->>'trackRecord')::int, 0))
         end
  where opportunity_weights ? 'trackRecord';
