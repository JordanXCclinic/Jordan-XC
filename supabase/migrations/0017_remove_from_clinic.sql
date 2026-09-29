-- Removing an athlete from the clinic.
--
-- The roster could be read but never trimmed: an athlete who left, or a test
-- account, stayed on it for good. This is the head coach's counterpart to
-- issuing a code, and is held to the same rule — letting a family in and
-- taking them out both stay with one person, not every assistant.
--
-- It removes the person outright, the way delete_my_account() does for someone
-- deleting themselves: the intake form, personal bests, training logs,
-- attendance, bookings and guardian links all hang off the account by ON
-- DELETE CASCADE. Nothing an athlete can hold is ON DELETE RESTRICT — those
-- are all staff-authored columns — so no record has to be handed on first.
-- Coming back next season is a fresh sign-in and a new code.
--
-- A parent whose only athlete this is goes too. Left behind, they would open
-- an app with nothing in it and no way to tell why. A parent with another
-- athlete still in the clinic keeps their access. Only accounts whose role is
-- 'parent' are ever taken this way: a coach who is also somebody's guardian
-- must never be removed as a side effect of removing their child.
--
-- The family's unredeemed codes are cancelled as well, or a parent code still
-- sitting in someone's inbox could be redeemed later into an empty account.
--
-- p_dry_run returns who would be removed without removing anyone, so the
-- confirmation the coach reads is worked out by the same query that acts on
-- it rather than a copy of it in the app.

create or replace function remove_from_clinic(p_athlete uuid, p_dry_run boolean default false)
returns table (person_id uuid, person_name text, person_role app_role)
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role;
  v_family uuid;
  v_ids uuid[];
begin
  if not is_head_coach(auth.uid()) then
    raise exception 'Only the head coach can remove someone from the clinic';
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
