-- Staff set up a runner whose parent has signed in but never set them up.
--
-- A parent who redeems the family's parent code and then stops leaves their
-- runners without accounts, so the coach cannot assign them training and they
-- are nowhere on the roster. This lets staff do what the parent would have
-- done with set_up_runner(): make the runner as a managed runner (no phone of
-- their own), linked to every parent in the family who has signed in. The
-- parent then finds them in the app with nothing else to do.
--
-- Only for a family whose parent has signed in: a managed runner belongs to a
-- parent, and is deleted with the last one who manages it. It spends the
-- runner's own code, as set_up_runner() does, so a runner who later wants to
-- sign in on their own phone needs a new code; the coach is told that before
-- doing it.

create or replace function runners_waiting_for_set_up()
returns table (invite_id uuid, runner_name text, runner_role app_role,
               parent_name text, parent_signed_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (runner.id)
         runner.id, runner.full_name, runner.role, p.full_name, parent.redeemed_at
    from invite_codes runner
    join invite_codes parent
      on parent.family_id = runner.family_id
     and parent.role = 'parent'
     and parent.redeemed_by is not null
    join profiles p on p.id = parent.redeemed_by
   where is_coach(auth.uid())
     and runner.role in ('athlete', 'private_client')
     and runner.redeemed_at is null
     and (runner.expires_at is null or runner.expires_at >= now())
   order by runner.id, parent.redeemed_at;
$$;

revoke all on function runners_waiting_for_set_up() from public, anon;
grant execute on function runners_waiting_for_set_up() to authenticated;

create or replace function staff_set_up_runner(p_invite uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
  v_parent uuid;
  v_athlete uuid;
begin
  if not is_coach(auth.uid()) then
    raise exception 'Only coaches can set up a runner';
  end if;

  select * into v_invite
    from invite_codes
   where id = p_invite
     and role in ('athlete', 'private_client')
   for update;

  if not found then
    raise exception 'That runner code no longer exists';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception '% is already set up', v_invite.full_name;
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'That runner''s code has expired. Issue a new one';
  end if;

  -- The parent who signed in first owns the account, as if they had set it up.
  select parent.redeemed_by into v_parent
    from invite_codes parent
   where parent.family_id = v_invite.family_id
     and parent.role = 'parent'
     and parent.redeemed_by is not null
   order by parent.redeemed_at
   limit 1;

  if v_invite.family_id is null or v_parent is null then
    raise exception 'Their parent has not signed in yet. A runner is set up under a parent''s account';
  end if;

  -- The same account set_up_runner() makes: nobody signs in to it. The empty
  -- strings stand in for token columns Supabase's auth server reads as text
  -- and rejects as NULL.
  v_athlete := gen_random_uuid();
  insert into auth.users (
    id, instance_id, aud, role, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    created_at, updated_at
  ) values (
    v_athlete, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    jsonb_build_object('provider', 'managed', 'providers', jsonb_build_array()),
    jsonb_build_object('managed_by', v_parent),
    '', '', '', '',
    now(), now()
  );

  insert into profiles (id, full_name, role, managed)
  values (v_athlete, v_invite.full_name, v_invite.role, true);

  update invite_codes
     set redeemed_by = v_athlete, redeemed_at = now()
   where id = v_invite.id;

  insert into guardian_links (athlete_id, guardian_id)
  select v_athlete, parent.redeemed_by
    from invite_codes parent
   where parent.family_id = v_invite.family_id
     and parent.role = 'parent'
     and parent.redeemed_by is not null
  on conflict (athlete_id, guardian_id) do nothing;

  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  values (auth.uid(), 'staff_set_up_runner', 'profiles', v_athlete,
          jsonb_build_object('family_id', v_invite.family_id, 'parent', v_parent));

  return v_athlete;
end;
$$;

revoke all on function staff_set_up_runner(uuid) from public, anon;
grant execute on function staff_set_up_runner(uuid) to authenticated;
