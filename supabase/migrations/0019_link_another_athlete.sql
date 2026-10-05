-- A parent with more than one child in the clinic.
--
-- Codes are issued one pair per child: an athlete code and a parent code that
-- share a family_id. A parent signs in and redeems the first child's parent
-- code, which creates their account. The second child's parent code had
-- nowhere to go: redeem_invite_code() refuses an account that already exists,
-- so the second child could never be linked to the same parent, and the
-- athlete switcher in the app — built for exactly this — never appeared.
--
-- This lets an existing parent redeem another parent code. It links them to
-- that family's athlete the same way the first code did, and changes nothing
-- else about the account: no role is set here, so it opens no route to a
-- different role (redeem_invite_code() remains the only writer of role).

create or replace function link_another_athlete(p_code text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
  v_linked int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only a parent account can add another athlete';
  end if;

  select * into v_invite
    from invite_codes
   where code = upper(btrim(p_code))
     and redeemed_at is null
   for update;

  if not found then
    raise exception 'That code is not valid, or it has already been used';
  end if;

  -- An athlete code belongs on the child's own account. Spending it here would
  -- leave the child with no way to sign in, so it is refused and left unused.
  if v_invite.role <> 'parent' then
    raise exception 'That is your runner''s own code. Use the parent code from your registration confirmation';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'That code has expired';
  end if;

  update invite_codes
     set redeemed_by = auth.uid(), redeemed_at = now()
   where id = v_invite.id;

  -- Same linking as redeem_invite_code(): every redeemed parent in the family
  -- to every redeemed athlete. If the child has not signed in yet, nothing is
  -- linked now, and their own redemption forms the link later.
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
  values (auth.uid(), 'link_another_athlete', 'invite_codes', v_invite.id,
          jsonb_build_object('family_id', v_invite.family_id));

  -- How many of this family's athletes are now linked to the caller, so the
  -- app can say whether the child appears now or once they have signed in.
  select count(*) into v_linked
    from guardian_links gl
    join invite_codes athlete on athlete.redeemed_by = gl.athlete_id
   where gl.guardian_id = auth.uid()
     and athlete.family_id = v_invite.family_id
     and athlete.role in ('athlete', 'private_client');

  return v_linked;
end;
$$;

revoke all on function link_another_athlete(text) from public, anon;
grant execute on function link_another_athlete(text) to authenticated;
