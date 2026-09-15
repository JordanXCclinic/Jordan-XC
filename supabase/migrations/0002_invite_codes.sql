-- Access model: sign in with Apple/Google, then redeem a code issued after the
-- family registers on the website. The code carries the role, so the client must
-- never be able to write profiles.role directly.

-- Roles are assigned by redeem_invite_code() alone. Without this, any signed-in
-- user could promote themselves: update profiles set role = 'admin'.
revoke update on profiles from authenticated;
grant update (full_name, phone, graduation_year, date_of_birth)
  on profiles to authenticated;

create table invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  role app_role not null,
  full_name text not null,
  season text not null,
  -- Pairs an athlete's code with their parent's so the guardian link forms
  -- whichever of the two signs in first.
  family_id uuid,
  expires_at timestamptz,
  created_by uuid not null references profiles on delete restrict,
  created_at timestamptz not null default now(),
  redeemed_by uuid references profiles on delete set null,
  redeemed_at timestamptz,
  constraint invite_codes_role_allowed
    check (role in ('athlete', 'private_client', 'parent', 'coach'))
);

create index on invite_codes (family_id);

alter table invite_codes enable row level security;

-- Only staff touch this table directly; redemption goes through the function
-- below, so an athlete can never read or enumerate unredeemed codes.
create policy invite_codes_coach_all on invite_codes for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create or replace function redeem_invite_code(p_code text)
returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_invite invite_codes%rowtype;
  v_profile profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'This account is already set up';
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

  insert into profiles (id, full_name, role)
  values (auth.uid(), v_invite.full_name, v_invite.role)
  returning * into v_profile;

  update invite_codes
     set redeemed_by = auth.uid(), redeemed_at = now()
   where id = v_invite.id;

  -- Link every redeemed parent in this family to every redeemed athlete,
  -- so the pair connects regardless of who signs in first.
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

  return v_profile;
end;
$$;

revoke all on function redeem_invite_code(text) from public, anon;
grant execute on function redeem_invite_code(text) to authenticated;
