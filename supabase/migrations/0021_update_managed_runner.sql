-- A parent filling in the profile of a runner without a phone.
--
-- The intake form (athlete_profiles) was already open to a parent through
-- can_view_athlete(). The runner's name was not: profiles is self-editable
-- only, and nobody signs in as a managed runner, so a name typed wrong at
-- set-up could never be corrected. This lets the runner's own parent set it,
-- and records the profile as filled in — the step an athlete with a phone
-- completes for themselves at first sign-in.
--
-- Managed runners only. A runner with a phone keeps sole charge of their own
-- name, as before.

create or replace function update_managed_runner(p_athlete uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from guardian_links gl
      join profiles runner on runner.id = gl.athlete_id and runner.managed
     where gl.athlete_id = p_athlete
       and gl.guardian_id = auth.uid()
  ) then
    raise exception 'Only the parent who manages this runner can change their details';
  end if;

  if v_name = '' then
    raise exception 'Enter your runner''s name';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'That name is too long';
  end if;

  update profiles
     set full_name = v_name,
         onboarded_at = coalesce(onboarded_at, now())
   where id = p_athlete;
end;
$$;

revoke all on function update_managed_runner(uuid, text) from public, anon;
grant execute on function update_managed_runner(uuid, text) to authenticated;
