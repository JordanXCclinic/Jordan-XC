-- Two ways a parent reaches their runner, made distinct.
--
-- 0019 let a parent type their runner's athlete code to set up an account for
-- a runner without a phone. That made the athlete code mean two different
-- things, and the dangerous one won: a parent "claiming" a runner who did have
-- a phone, before the runner had signed in, spent the code on a managed
-- account and locked the runner out of their own.
--
-- Now:
--
--   * The athlete code, typed by a parent, only ever claims: it links them to
--     that runner and never spends the code. If the runner has not signed in
--     yet, nothing is used up and the link forms when they do.
--
--   * A runner without a phone is set up by name, with set_up_runner(). The
--     parent never needs the athlete code for it. The name starts as the one
--     the coach typed when issuing the codes, which my_runners_to_set_up()
--     offers, so it is usually a single tap.
--
-- Both accept only families whose parent code this parent has redeemed. The
-- caller's own role is never touched; a managed runner's role is the one their
-- family's athlete code carries.

-- ---------------------------------------------------------------------------
-- Claiming, and adding another child.
-- ---------------------------------------------------------------------------

create or replace function add_athlete_to_family(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only a parent account can add an athlete';
  end if;

  -- Not filtered on redeemed_at: claiming a runner who has already signed in
  -- is the point of an athlete code here.
  select * into v_invite
    from invite_codes
   where code = upper(btrim(p_code))
   for update;

  if not found then
    raise exception 'That code is not valid. Check it against your registration confirmation';
  end if;

  if v_invite.role = 'parent' then
    if v_invite.redeemed_at is not null then
      raise exception 'That parent code has already been used';
    end if;
    if v_invite.expires_at is not null and v_invite.expires_at < now() then
      raise exception 'That code has expired';
    end if;

    update invite_codes
       set redeemed_by = auth.uid(), redeemed_at = now()
     where id = v_invite.id;

  elsif v_invite.role in ('athlete', 'private_client') then
    if v_invite.family_id is null
       or not exists (
         select 1 from invite_codes mine
          where mine.family_id = v_invite.family_id
            and mine.role = 'parent'
            and mine.redeemed_by = auth.uid()
       ) then
      raise exception 'That athlete code is from a different registration than your parent code. Enter the parent code that came with it first';
    end if;
    -- Nothing is written to the code. Claimed or not, it stays the runner's.

  else
    raise exception 'That code cannot be used here';
  end if;

  if v_invite.family_id is not null then
    insert into guardian_links (athlete_id, guardian_id)
    select athlete.redeemed_by, parent.redeemed_by
      from invite_codes athlete
      join invite_codes parent on parent.family_id = athlete.family_id
     where athlete.family_id = v_invite.family_id
       and athlete.role in ('athlete', 'private_client')
       and athlete.redeemed_by is not null
       and parent.role = 'parent'
       and parent.redeemed_by is not null
    on conflict (athlete_id, guardian_id) do nothing;
  end if;

  if v_invite.role = 'parent' then
    insert into audit_log (actor_id, action, table_name, record_id, metadata)
    values (auth.uid(), 'add_athlete_to_family', 'invite_codes', v_invite.id,
            jsonb_build_object('family_id', v_invite.family_id));
  end if;

  if exists (
    select 1 from guardian_links gl
      join invite_codes athlete on athlete.redeemed_by = gl.athlete_id
     where gl.guardian_id = auth.uid()
       and athlete.family_id = v_invite.family_id
       and athlete.role in ('athlete', 'private_client')
  ) then
    return 'linked';
  end if;
  return 'pending';
end;
$$;

revoke all on function add_athlete_to_family(text) from public, anon;
grant execute on function add_athlete_to_family(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Runners waiting to be set up.
-- ---------------------------------------------------------------------------

-- The runners in this parent's families who have no account yet, with the
-- name the coach issued the codes under. Read through here because parents
-- cannot read invite_codes, and this returns nothing but their own runners'
-- names.
create or replace function my_runners_to_set_up()
returns table (family_id uuid, runner_name text)
language sql stable security definer set search_path = public as $$
  select athlete.family_id, athlete.full_name
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

-- ---------------------------------------------------------------------------
-- Setting up a runner without a phone.
-- ---------------------------------------------------------------------------

create or replace function set_up_runner(p_family uuid, p_name text)
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

  -- The family's athlete code is what makes this a clinic runner, and spending
  -- it means the same runner cannot also be set up a second time, by this
  -- parent or by the code itself.
  select * into v_invite
    from invite_codes
   where family_id = p_family
     and role in ('athlete', 'private_client')
     and redeemed_at is null
   order by created_at
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

revoke all on function set_up_runner(uuid, text) from public, anon;
grant execute on function set_up_runner(uuid, text) to authenticated;
