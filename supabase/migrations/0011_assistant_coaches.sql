-- Assistant coaches.
--
-- The clinic has a head coach and two assistants. Both run practices, write
-- training and post announcements, so is_coach() still covers all of them.
-- What only the head coach does is hand out access to the clinic: issuing a
-- code is how a family gets in, and that stays with one person.
--
-- 'admin' is the head coach, 'coach' an assistant. No new role is needed.

create or replace function is_head_coach(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

-- Assistants no longer read or write the code table. An assistant who needs a
-- family let in asks the head coach, which is the same conversation that
-- happens now over text.
drop policy invite_codes_coach_all on invite_codes;
create policy invite_codes_head_coach_all on invite_codes for all
  using (is_head_coach(auth.uid())) with check (is_head_coach(auth.uid()));

create or replace function create_family_codes(
  p_full_name text,
  p_season text,
  p_athlete_role app_role default 'athlete',
  p_expires_at timestamptz default null
)
returns table (athlete_code text, parent_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_family uuid := gen_random_uuid();
  v_athlete text;
  v_parent text;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if not is_head_coach(auth.uid()) then
    raise exception 'Only the head coach can create invite codes';
  end if;

  if v_name = '' then
    raise exception 'An athlete name is required';
  end if;

  if p_athlete_role not in ('athlete', 'private_client') then
    raise exception 'Codes pair a parent with an athlete or a one-on-one client';
  end if;

  loop
    v_athlete := random_code();
    exit when not exists (select 1 from invite_codes where code = v_athlete);
  end loop;

  loop
    v_parent := random_code();
    exit when not exists (select 1 from invite_codes where code = v_parent);
  end loop;

  insert into invite_codes (code, role, full_name, season, family_id, expires_at, created_by)
  values
    (v_athlete, p_athlete_role, v_name, p_season, v_family, p_expires_at, auth.uid()),
    (v_parent, 'parent', v_name || ' (parent)', p_season, v_family, p_expires_at, auth.uid());

  athlete_code := v_athlete;
  parent_code := v_parent;
  return next;
end;
$$;

revoke all on function create_family_codes(text, text, app_role, timestamptz) from public, anon;
grant execute on function create_family_codes(text, text, app_role, timestamptz) to authenticated;
