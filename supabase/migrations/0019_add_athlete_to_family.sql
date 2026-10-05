-- Linking a parent to a runner who is not linked yet.
--
-- Codes come one pair per child: an athlete code and a parent code that share
-- a family_id. Until now a parent was linked only when the child redeemed
-- their own code on their own phone, which left two families stranded:
--
--   * A runner with no phone of their own. Many of these athletes are young,
--     and the child never signing in meant the parent never saw their runner.
--   * A parent with a second child. redeem_invite_code() refuses an account
--     that already exists, so the second child's parent code had nowhere to go.
--
-- add_athlete_to_family() is for a signed-in parent, and takes either code:
--
--   * A parent code links them to that family's runner, exactly as the first
--     code did. If the runner has not signed in yet, the link forms when they
--     do.
--   * An athlete code creates the runner's account for them, managed by the
--     parent. Accepted only for a family whose parent code this parent has
--     already redeemed, so holding a stray athlete code is not a way to attach
--     yourself to someone else's child.
--
-- The caller's own role is never touched. The managed runner's role comes
-- from their athlete code, as every role does.

-- Defined briefly under another name and never released; cleared in case it
-- was created by hand.
drop function if exists link_another_athlete(text);

alter table profiles add column managed boolean not null default false;

comment on column profiles.managed is
  'A runner without a phone: the account was created by their parent from the
   athlete code, nobody signs in as it, and the parent does everything for them.
   Deleted along with the last parent who manages it.';

create or replace function add_athlete_to_family(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
  v_athlete uuid;
  v_result text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only a parent account can add an athlete';
  end if;

  select * into v_invite
    from invite_codes
   where code = upper(btrim(p_code))
     and redeemed_at is null
   for update;

  if not found then
    raise exception 'That code is not valid, or it has already been used';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'That code has expired';
  end if;

  if v_invite.role = 'parent' then
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
      raise exception 'That athlete code is for a different family. Use the parent code that came with it first';
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
    values (v_athlete, v_invite.full_name, v_invite.role, true);

    update invite_codes
       set redeemed_by = v_athlete, redeemed_at = now()
     where id = v_invite.id;

  else
    raise exception 'That code cannot be used here';
  end if;

  -- Same linking as redeem_invite_code(): every redeemed parent in the family
  -- to every redeemed athlete.
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

  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  values (auth.uid(), 'add_athlete_to_family', 'invite_codes', v_invite.id,
          jsonb_build_object('family_id', v_invite.family_id, 'code_role', v_invite.role,
                             'managed_athlete', v_athlete));

  -- What the app tells the parent: their runner is here now, or will be once
  -- the runner signs in with their own code.
  if v_athlete is not null then
    v_result := 'managed';
  elsif exists (
    select 1 from guardian_links gl
      join invite_codes athlete on athlete.redeemed_by = gl.athlete_id
     where gl.guardian_id = auth.uid()
       and athlete.family_id = v_invite.family_id
       and athlete.role in ('athlete', 'private_client')
  ) then
    v_result := 'linked';
  else
    v_result := 'pending';
  end if;

  return v_result;
end;
$$;

revoke all on function add_athlete_to_family(text) from public, anon;
grant execute on function add_athlete_to_family(text) to authenticated;

-- Deleting a parent's account takes the runners only they manage with it.
-- Otherwise a managed runner would be left with no one able to reach them,
-- and no way in. Unchanged from 0007 apart from that block.
create or replace function delete_my_account()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid();
  v_role app_role;
  v_heir uuid;
  v_managed uuid[];
begin
  if v_id is null then
    raise exception 'Not signed in';
  end if;

  select role into v_role from profiles where id = v_id;
  if v_role is null then
    -- Signed in but never redeemed a code: nothing of ours to unpick.
    delete from auth.users where id = v_id;
    return;
  end if;

  if is_coach(v_id) then
    -- Practices, announcements, plans and codes are the clinic's records, not
    -- the coach's, and they are referenced with ON DELETE RESTRICT so they
    -- cannot be silently destroyed. Hand them to another member of staff.
    select id into v_heir
      from profiles
     where role in ('admin', 'coach') and id <> v_id
     order by created_at
     limit 1;

    if v_heir is null then
      raise exception 'You are the only coach on this clinic. Add another coach before deleting your account, so the schedule, plans and announcements are not lost.';
    end if;

    update practices set created_by = v_heir where created_by = v_id;
    update attendance set recorded_by = v_heir where recorded_by = v_id;
    update announcements set author_id = v_heir where author_id = v_id;
    update posts set author_id = v_heir where author_id = v_id;
    update training_plans set created_by = v_heir where created_by = v_id;
    update plan_assignments set assigned_by = v_heir where assigned_by = v_id;
    update invite_codes set created_by = v_heir where created_by = v_id;
    update photos set uploaded_by = v_heir where uploaded_by = v_id;
    update meeting_slots set created_by = v_heir where created_by = v_id;
  end if;

  v_managed := coalesce(array(
    select gl.athlete_id
      from guardian_links gl
      join profiles athlete on athlete.id = gl.athlete_id and athlete.managed
     where gl.guardian_id = v_id
       and not exists (
         select 1 from guardian_links other
          where other.athlete_id = gl.athlete_id
            and other.guardian_id <> v_id
       )
  ), '{}');

  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  values (null, 'delete_account', 'profiles', v_id,
          jsonb_build_object('role', v_role, 'reassigned_to', v_heir,
                             'managed_runners', to_jsonb(v_managed)));

  -- Everything personal hangs off profiles or auth.users by ON DELETE CASCADE:
  -- the intake form, personal bests, training logs, attendance, guardian links,
  -- and any meeting booked for them.
  delete from auth.users where id = any(v_managed);
  delete from auth.users where id = v_id;
end;
$$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
