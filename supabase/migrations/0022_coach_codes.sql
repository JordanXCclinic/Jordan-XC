-- Coach codes, and assistants with the head coach's tools.
--
-- 0011 kept issuing codes with the head coach alone, and 0017 did the same for
-- removing someone from the clinic. The clinic has since decided its
-- assistants work the same screens as the head coach: letting a family in,
-- taking one out, and now bringing on another coach. Every member of staff can
-- do all of it, so these checks go back to is_coach().
--
-- 'admin' and 'coach' stay separate roles, so the app can still say who is the
-- head coach and who is an assistant. They no longer differ in what they can do.
--
-- A coach code is single-use like any other and carries the role 'coach', so
-- redeem_invite_code() stays the only path that gives anyone a role. It has no
-- family: there is no parent to pair it with.

drop policy invite_codes_head_coach_all on invite_codes;
create policy invite_codes_staff_all on invite_codes for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

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
  if not is_coach(auth.uid()) then
    raise exception 'Only coaches can create invite codes';
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

create or replace function create_coach_code(p_full_name text, p_season text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if not is_coach(auth.uid()) then
    raise exception 'Only coaches can create a coach code';
  end if;

  if v_name = '' then
    raise exception 'Enter the coach''s name';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'That name is too long';
  end if;

  loop
    v_code := random_code();
    exit when not exists (select 1 from invite_codes where code = v_code);
  end loop;

  insert into invite_codes (code, role, full_name, season, created_by)
  values (v_code, 'coach', v_name, p_season, auth.uid());

  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  select auth.uid(), 'create_coach_code', 'invite_codes', c.id, jsonb_build_object('name', v_name)
    from invite_codes c
   where c.code = v_code;

  return v_code;
end;
$$;

revoke all on function create_coach_code(text, text) from public, anon;
grant execute on function create_coach_code(text, text) to authenticated;

create or replace function remove_from_clinic(p_athlete uuid, p_dry_run boolean default false)
returns table (person_id uuid, person_name text, person_role app_role)
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role;
  v_family uuid;
  v_ids uuid[];
begin
  if not is_coach(auth.uid()) then
    raise exception 'Only coaches can remove someone from the clinic';
  end if;

  select p.role into v_role from profiles p where p.id = p_athlete;
  if v_role is null then
    raise exception 'That person is not on the roster';
  end if;
  if v_role not in ('athlete', 'private_client') then
    raise exception 'Only athletes and one-on-one clients are removed from the roster';
  end if;

  v_ids := array[p_athlete] || coalesce(array(
    select g.guardian_id
      from guardian_links g
      join profiles gp on gp.id = g.guardian_id and gp.role = 'parent'
     where g.athlete_id = p_athlete
       and not exists (
         select 1 from guardian_links other
          where other.guardian_id = g.guardian_id
            and other.athlete_id <> p_athlete
       )
  ), '{}');

  -- Materialised now, before anything is deleted, so a real run reports the
  -- same people a dry run does.
  return query
    select p.id, p.full_name, p.role
      from profiles p
     where p.id = any(v_ids)
     order by (p.id = p_athlete) desc, p.full_name;

  if p_dry_run then
    return;
  end if;

  select c.family_id into v_family
    from invite_codes c
   where c.redeemed_by = p_athlete and c.family_id is not null
   limit 1;
  if v_family is not null then
    delete from invite_codes c where c.family_id = v_family and c.redeemed_at is null;
  end if;

  -- Written while the rows still exist to read the roles from. The actor stays
  -- on the log; the removed people are recorded by id alone.
  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  select auth.uid(), 'remove_from_clinic', 'profiles', p.id,
         jsonb_build_object('role', p.role, 'athlete', p_athlete)
    from profiles p
   where p.id = any(v_ids);

  delete from auth.users u where u.id = any(v_ids);
end;
$$;

revoke all on function remove_from_clinic(uuid, boolean) from public, anon;
grant execute on function remove_from_clinic(uuid, boolean) to authenticated;

-- Nothing calls it any more.
drop function is_head_coach(uuid);
