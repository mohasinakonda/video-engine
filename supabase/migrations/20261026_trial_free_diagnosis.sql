-- Channel Doctor: free diagnoses on the Trial plan, so a new user sees their own channel's problems
-- before paying. Counted per user and per YouTube channel, so new accounts on the same channel
-- don't get more. Only the server (service role) reads or writes the claims.

alter table public.channel_doctor_settings
  add column if not exists trial_free_diagnoses int not null default 1 check (trial_free_diagnoses between 0 and 10);

create table if not exists public.free_diagnosis_claims (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  channel_id  text not null check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  created_at  timestamptz not null default now()
);

create index if not exists free_diagnosis_claims_user_idx on public.free_diagnosis_claims (user_id);
create index if not exists free_diagnosis_claims_channel_idx on public.free_diagnosis_claims (channel_id);
-- RLS on with no policies: users can't read or change their claims.
alter table public.free_diagnosis_claims enable row level security;

-- Claims one free diagnosis if neither the user nor the channel has used up the limit.
-- Returns the claim id (to give it back if the run fails), or null.
create or replace function public.claim_free_diagnosis(p_user_id uuid, p_channel_id text, p_limit int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_id uuid;
begin
  if p_limit <= 0 then
    return null;
  end if;
  -- One claim at a time per channel, so two accounts can't race past the limit.
  perform pg_advisory_xact_lock(hashtext('free_diagnosis:' || p_channel_id));
  if (select count(*) from free_diagnosis_claims where user_id = p_user_id) >= p_limit
     or (select count(*) from free_diagnosis_claims where channel_id = p_channel_id) >= p_limit then
    return null;
  end if;
  insert into free_diagnosis_claims (user_id, channel_id) values (p_user_id, p_channel_id) returning id into claim_id;
  return claim_id;
end;
$$;

revoke all on function public.claim_free_diagnosis(uuid, text, int) from public, anon, authenticated;
grant execute on function public.claim_free_diagnosis(uuid, text, int) to service_role;
