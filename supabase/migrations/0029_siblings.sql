-- Brothers and sisters: one parent code for every runner in a family.
--
-- Until now a code pair was one runner and one parent, so a parent of two
-- runners redeemed two parent codes. Nothing else assumed one runner per
-- family: guardian links already join every runner code in a family_id to
-- every parent code in it. So siblings are runner codes that share a
-- family_id, under one parent code, and that parent code links the parent to
-- all of them.
--
--   * create_family_codes_for() issues a family at once: a runner code for
--     each name and one parent code.
--   * add_runner_to_family() adds a runner to a family that already has
--     codes, found by its parent code, used or not.
--
-- The places that took "the" runner of a family now pick the right one:
--
--   * set_up_runner() spends the code of the runner being set up (by invite
--     id, else the name the coach issued it under), so setting up one child
--     without a phone cannot spend a sibling's code and lock them out.
--   * my_runners_to_set_up() returns each runner's invite id so the app can
--     tell two runners in one family apart.
--   * remove_from_clinic() keeps the family's codes, and the parent, while a
--     sibling still has a code waiting to be used.

-- ---------------------------------------------------------------------------
-- Issuing.
-- ---------------------------------------------------------------------------

create or replace function create_family_codes_for(
  p_names text[],
  p_season text,
  p_athlete_role app_role default 'athlete',
  p_expires_at timestamptz default null
)
returns table (runner_name text, athlete_code text, parent_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_family uuid := gen_random_uuid();
  v_names text[];
  v_name text;
  v_code text;
  v_parent text;
begin
  if not is_coach(auth.uid()) then
    raise exception 'Only coaches can create invite codes';
  end if;

  if p_athlete_role not in ('athlete', 'private_client') then
    raise exception 'Codes pair a parent with an athlete or a one-on-one client';
  end if;

  select coalesce(array_agg(btrim(n) order by ord), '{}') into v_names
    from unnest(p_names) with ordinality as t(n, ord)
   where btrim(coalesce(n, '')) <> '';

  if cardinality(v_names) = 0 then
    raise exception 'An athlete name is required';
  end if;
  if cardinality(v_names) > 6 then
    raise exception 'A family can have up to 6 runners';
  end if;
  if exists (select 1 from unnest(v_names) n where char_length(n) > 80) then
    raise exception 'That name is too long';
  end if;

  loop
    v_parent := random_code();
    exit when not exists (select 1 from invite_codes where code = v_parent);
  end loop;

  insert into invite_codes (code, role, full_name, season, family_id, expires_at, created_by)
  values (v_parent, 'parent', array_to_string(v_names, ' & ') || ' (parent)',
          p_season, v_family, p_expires_at, auth.uid());

  foreach v_name in array v_names loop
    loop
      v_code := random_code();
      exit when not exists (select 1 from invite_codes where code = v_code);
    end loop;

    insert into invite_codes (code, role, full_name, season, family_id, expires_at, created_by)
    values (v_code, p_athlete_role, v_name, p_season, v_family, p_expires_at, auth.uid());

    runner_name := v_name;
    athlete_code := v_code;
    parent_code := v_parent;
    return next;
  end loop;
end;
$$;

revoke all on function create_family_codes_for(text[], text, app_role, timestamptz) from public, anon;
grant execute on function create_family_codes_for(text[], text, app_role, timestamptz) to authenticated;

create or replace function add_runner_to_family(
  p_parent_code text,
  p_full_name text,
  p_season text,
  p_athlete_role app_role default 'athlete'
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_parent invite_codes%rowtype;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_code text;
  v_others text;
begin
  if not is_coach(auth.uid()) then
    raise exception 'Only coaches can create invite codes';
  end if;

  if v_name = '' then
    raise exception 'An athlete name is required';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'That name is too long';
  end if;
  if p_athlete_role not in ('athlete', 'private_client') then
    raise exception 'Codes pair a parent with an athlete or a one-on-one client';
  end if;

  select * into v_parent
    from invite_codes
   where code = upper(btrim(coalesce(p_parent_code, '')))
     and role = 'parent'
   for update;

  if not found or v_parent.family_id is null then
    raise exception 'No family has that parent code. Check it in the list of codes';
  end if;

  if (select count(*) from invite_codes
       where family_id = v_parent.family_id
         and role in ('athlete', 'private_client')) >= 6 then
    raise exception 'A family can have up to 6 runners';
  end if;

  loop
    v_code := random_code();
    exit when not exists (select 1 from invite_codes where code = v_code);
  end loop;

  insert into invite_codes (code, role, full_name, season, family_id, expires_at, created_by)
  values (v_code, p_athlete_role, v_name, p_season, v_parent.family_id, v_parent.expires_at,
          auth.uid());

  -- An unused parent code is relabelled so the list of codes says who it is
  -- for. A used one keeps its label: it is a record of what was redeemed.
  if v_parent.redeemed_at is null then
    select string_agg(full_name, ' & ' order by created_at) into v_others
      from invite_codes
     where family_id = v_parent.family_id
       and role in ('athlete', 'private_client');
    update invite_codes set full_name = v_others || ' (parent)' where id = v_parent.id;
  end if;

  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  select auth.uid(), 'add_runner_to_family', 'invite_codes', c.id,
         jsonb_build_object('family_id', v_parent.family_id)
    from invite_codes c
   where c.code = v_code;

  return v_code;
end;
$$;

revoke all on function add_runner_to_family(text, text, text, app_role) from public, anon;
grant execute on function add_runner_to_family(text, text, text, app_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Setting up a runner without a phone, one of several.
-- ---------------------------------------------------------------------------

-- The return type gains a column, which create or replace cannot do.
drop function my_runners_to_set_up();

create function my_runners_to_set_up()
returns table (family_id uuid, runner_name text, invite_id uuid)
language sql stable security definer set search_path = public as $$
  select athlete.family_id, athlete.full_name, athlete.id
    from invite_codes athlete
    join invite_codes mine
      on mine.family_id = athlete.family_id
     and mine.role = 'parent'
     and mine.redeemed_by = auth.uid()
   where athlete.role in ('athlete', 'private_client')
     and athlete.redeemed_at is null
     and (athlete.expires_at is null or athlete.expires_at >= now())
   order by athlete.full_name;
$$;

revoke all on function my_runners_to_set_up() from public, anon;
grant execute on function my_runners_to_set_up() to authenticated;

-- A third argument with a default would sit beside the old two-argument
-- function and make every two-argument call ambiguous, so the old one goes.
-- Calls by name with p_family and p_name still reach this one.
drop function set_up_runner(uuid, text);

create function set_up_runner(p_family uuid, p_name text, p_invite uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_athlete uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only a parent account can set up a runner';
  end if;

  if v_name = '' then
    raise exception 'Enter your runner''s name';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'That name is too long';
  end if;

  if not exists (
    select 1 from invite_codes mine
     where mine.family_id = p_family
       and mine.role = 'parent'
       and mine.redeemed_by = auth.uid()
  ) then
    raise exception 'That runner is not in your family';
  end if;

  -- Which of the family's runner codes this is. The one asked for by id; else
  -- the one issued under the name typed, which is the name the app offers;
  -- else the oldest, as before siblings.
  select * into v_invite
    from invite_codes
   where family_id = p_family
     and role in ('athlete', 'private_client')
     and redeemed_at is null
     and (p_invite is null or id = p_invite)
   order by (lower(btrim(full_name)) = lower(v_name)) desc, created_at
   limit 1
   for update;

  if not found then
    raise exception 'Your runner already has an account. If they have a phone, they signed in with their own code';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Your runner''s code has expired. Ask the clinic for a new one';
  end if;

  -- An account nobody signs in to: no email, no password, no identity. It
  -- exists so the runner's training, schedule and profile have an owner.
  -- The empty strings stand in for token columns Supabase's auth server
  -- reads as text and rejects as NULL.
  v_athlete := gen_random_uuid();
  insert into auth.users (
    id, instance_id, aud, role, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    created_at, updated_at
  ) values (
    v_athlete, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    jsonb_build_object('provider', 'managed', 'providers', jsonb_build_array()),
    jsonb_build_object('managed_by', auth.uid()),
    '', '', '', '',
    now(), now()
  );

  insert into profiles (id, full_name, role, managed)
  values (v_athlete, v_name, v_invite.role, true);

  update invite_codes
     set redeemed_by = v_athlete, redeemed_at = now()
   where id = v_invite.id;

  insert into guardian_links (athlete_id, guardian_id)
  select v_athlete, parent.redeemed_by
    from invite_codes parent
   where parent.family_id = p_family
     and parent.role = 'parent'
     and parent.redeemed_by is not null
  on conflict (athlete_id, guardian_id) do nothing;

  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  values (auth.uid(), 'set_up_runner', 'profiles', v_athlete,
          jsonb_build_object('family_id', p_family));

  return v_athlete;
end;
$$;

revoke all on function set_up_runner(uuid, text, uuid) from public, anon;
grant execute on function set_up_runner(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Removing one runner of several.
-- ---------------------------------------------------------------------------

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

  -- A parent goes with their last runner: no other runner linked to them, and
  -- no brother or sister still waiting to sign in on a code in their family.
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
       and not exists (
         select 1 from invite_codes mine
           join invite_codes sibling on sibling.family_id = mine.family_id
          where mine.redeemed_by = g.guardian_id
            and mine.role = 'parent'
            and sibling.role in ('athlete', 'private_client')
            and sibling.redeemed_at is null
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

  -- The family's unused codes go with its last runner. While a sibling still
  -- has a runner code, used or not, the family and its parent code stay.
  select c.family_id into v_family
    from invite_codes c
   where c.redeemed_by = p_athlete and c.family_id is not null
   limit 1;
  if v_family is not null and not exists (
    select 1 from invite_codes sibling
     where sibling.family_id = v_family
       and sibling.role in ('athlete', 'private_client')
       and sibling.redeemed_by is distinct from p_athlete
       and (sibling.redeemed_at is null or sibling.redeemed_by is not null)
  ) then
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
