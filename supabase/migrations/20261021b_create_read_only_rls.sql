-- Users may only read their Create rows; all writes go through the server (service role),
-- which enforces the project state machine and verifies video ownership.
-- Replaces the read-write policies of the first version of 20261021_create.sql.
drop policy if exists "Users manage own video projects" on public.video_projects;
drop policy if exists "Users read own video projects" on public.video_projects;
create policy "Users read own video projects" on public.video_projects
  for select using (auth.uid() = user_id);

drop policy if exists "Users manage own published videos" on public.published_videos;
drop policy if exists "Users read own published videos" on public.published_videos;
create policy "Users read own published videos" on public.published_videos
  for select using (auth.uid() = user_id);
