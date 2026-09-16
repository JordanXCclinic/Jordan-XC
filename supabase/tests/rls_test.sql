\set ON_ERROR_STOP on

-- Fixed ids so assertions are readable.
\set coach   '''11111111-1111-1111-1111-111111111111'''
\set athlete '''22222222-2222-2222-2222-222222222222'''
\set parent  '''33333333-3333-3333-3333-333333333333'''
\set sneak   '''44444444-4444-4444-4444-444444444444'''
\set fam     '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''

insert into auth.users (id) values (:coach), (:athlete), (:parent), (:sneak);
insert into profiles (id, full_name, role) values (:coach, 'Will Jordan', 'admin');

insert into invite_codes (code, role, full_name, season, family_id, created_by) values
  ('ATH12345', 'athlete', 'Sam Runner', '2026', :fam, :coach),
  ('PAR12345', 'parent',  'Pat Runner', '2026', :fam, :coach),
  ('EXP00000', 'athlete', 'Old Code',   '2025', null, :coach);

update invite_codes set expires_at = now() - interval '1 day' where code = 'EXP00000';

-- Athlete signs in and redeems. Lowercase input exercises the normalization.
set role authenticated;
select set_config('request.jwt.claim.sub', :athlete, false);
select redeem_invite_code('  ath12345  ');

do $$
begin
  if (select role from profiles where id = '22222222-2222-2222-2222-222222222222') = 'athlete'
  then raise notice 'PASS: athlete code assigned the athlete role';
  else raise notice 'FAIL: wrong role after redemption';
  end if;
end $$;

-- The bug this migration exists to close.
do $$
begin
  update profiles set role = 'admin' where id = auth.uid();
  raise notice 'FAIL: athlete escalated themselves to admin';
exception when others then
  raise notice 'PASS: role escalation blocked (%)', sqlerrm;
end $$;

-- Editing their own name must still work.
do $$
begin
  update profiles set full_name = 'Sam R.' where id = auth.uid();
  raise notice 'PASS: athlete can still edit their own name';
exception when others then
  raise notice 'FAIL: athlete cannot edit own name (%)', sqlerrm;
end $$;

-- A redeemed code cannot be handed to someone else.
select set_config('request.jwt.claim.sub', :sneak, false);
do $$
begin
  perform redeem_invite_code('ATH12345');
  raise notice 'FAIL: a used code was accepted again';
exception when others then
  raise notice 'PASS: used code rejected (%)', sqlerrm;
end $$;

do $$
begin
  perform redeem_invite_code('EXP00000');
  raise notice 'FAIL: an expired code was accepted';
exception when others then
  raise notice 'PASS: expired code rejected (%)', sqlerrm;
end $$;

-- Codes must not be readable by a non-coach.
do $$
declare n int;
begin
  select count(*) into n from invite_codes;
  if n = 0 then raise notice 'PASS: non-coach cannot read invite codes';
  else raise notice 'FAIL: non-coach read % invite codes', n;
  end if;
end $$;

-- Parent redeems second; the guardian link should form anyway.
select set_config('request.jwt.claim.sub', :parent, false);
select redeem_invite_code('PAR12345');

reset role;
do $$
declare n int;
begin
  select count(*) into n from guardian_links
   where athlete_id = '22222222-2222-2222-2222-222222222222'
     and guardian_id = '33333333-3333-3333-3333-333333333333';
  if n = 1 then raise notice 'PASS: parent linked to athlete across separate redemptions';
  else raise notice 'FAIL: guardian link count = %', n;
  end if;
end $$;

-- Parent can see their own athlete; an unrelated user cannot.
set role authenticated;
select set_config('request.jwt.claim.sub', :parent, false);
do $$
declare n int;
begin
  select count(*) into n from profiles
   where id = '22222222-2222-2222-2222-222222222222';
  if n = 1 then raise notice 'PASS: parent can see their athlete';
  else raise notice 'FAIL: parent cannot see their athlete';
  end if;
end $$;

select set_config('request.jwt.claim.sub', :sneak, false);
do $$
declare n int;
begin
  select count(*) into n from profiles
   where id = '22222222-2222-2222-2222-222222222222';
  if n = 0 then raise notice 'PASS: unrelated user cannot see the athlete';
  else raise notice 'FAIL: unrelated user can see the athlete';
  end if;
end $$;

reset role;

-- Code generation (0003).

\set newathlete '''55555555-5555-5555-5555-555555555555'''
\set newparent  '''66666666-6666-6666-6666-666666666666'''

insert into auth.users (id) values (:newathlete), (:newparent);

create table issued (athlete_code text, parent_code text);
grant all on issued to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', :coach, false);
insert into issued select * from create_family_codes('New Runner', '2026');

do $$
declare a text; p text;
begin
  select athlete_code, parent_code into a, p from issued;
  if a ~ '^[ABCDEFGHJKLMNPQR]{10}$' and p ~ '^[ABCDEFGHJKLMNPQR]{10}$' and a <> p
  then raise notice 'PASS: generated codes are well formed and distinct';
  else raise notice 'FAIL: malformed codes a=% p=%', a, p;
  end if;
end $$;

-- An athlete must not be able to mint codes for anyone.
select set_config('request.jwt.claim.sub', :athlete, false);
do $$
begin
  perform create_family_codes('Sneaky Runner', '2026');
  raise notice 'FAIL: a non-coach generated invite codes';
exception when others then
  raise notice 'PASS: non-coach cannot generate codes (%)', sqlerrm;
end $$;

-- The generated pair must work end to end.
do $$
declare a text; p text;
begin
  select athlete_code, parent_code into a, p from issued;

  perform set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
  perform redeem_invite_code(a);

  perform set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
  perform redeem_invite_code(p);

  if (select role from profiles where id = '55555555-5555-5555-5555-555555555555') = 'athlete'
     and (select role from profiles where id = '66666666-6666-6666-6666-666666666666') = 'parent'
  then raise notice 'PASS: generated codes assign the right roles';
  else raise notice 'FAIL: generated codes assigned wrong roles';
  end if;
end $$;

reset role;
do $$
declare n int;
begin
  select count(*) into n from guardian_links
   where athlete_id = '55555555-5555-5555-5555-555555555555'
     and guardian_id = '66666666-6666-6666-6666-666666666666';
  if n = 1 then raise notice 'PASS: generated pair links parent to athlete';
  else raise notice 'FAIL: generated pair did not link (count %)', n;
  end if;
end $$;
