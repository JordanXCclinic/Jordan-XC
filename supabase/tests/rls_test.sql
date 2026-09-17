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

-- ---------------------------------------------------------------------------
-- Intake forms and health information (0004).
--
-- athlete 22… and parent 33… are linked. athlete 55… is a real, unrelated
-- athlete — a better probe than a user with no profile at all, because it is
-- the case that actually happens: two families in the same clinic.
-- ---------------------------------------------------------------------------

set role authenticated;
select set_config('request.jwt.claim.sub', :athlete, false);

do $$
begin
  insert into athlete_profiles (athlete_id, school, grade, medical_notes, emergency_contact_name)
  values (auth.uid(), 'Mountain Brook', '9th', 'Carries an inhaler', 'Pat Runner');
  raise notice 'PASS: athlete can fill in their own intake form';
exception when others then
  raise notice 'FAIL: athlete cannot write own intake form (%)', sqlerrm;
end $$;

-- Guardians fill these in for younger runners, so they get write access too.
select set_config('request.jwt.claim.sub', :parent, false);
do $$
declare v_notes text;
begin
  select medical_notes into v_notes from athlete_profiles
   where athlete_id = '22222222-2222-2222-2222-222222222222';
  if v_notes = 'Carries an inhaler'
  then raise notice 'PASS: parent can read their athlete''s medical notes';
  else raise notice 'FAIL: parent could not read medical notes (got %)', coalesce(v_notes, 'null');
  end if;
end $$;

do $$
begin
  update athlete_profiles set goals = 'Break 18:00'
   where athlete_id = '22222222-2222-2222-2222-222222222222';
  if found then raise notice 'PASS: parent can update their athlete''s intake form';
  else raise notice 'FAIL: parent update matched no rows';
  end if;
exception when others then
  raise notice 'FAIL: parent cannot update intake form (%)', sqlerrm;
end $$;

-- The whole point of the separate table: another clinic family sees nothing.
select set_config('request.jwt.claim.sub', :newathlete, false);
do $$
declare n int;
begin
  select count(*) into n from athlete_profiles
   where athlete_id = '22222222-2222-2222-2222-222222222222';
  if n = 0 then raise notice 'PASS: another athlete cannot read medical notes';
  else raise notice 'FAIL: another athlete read % intake rows', n;
  end if;
end $$;

do $$
begin
  insert into athlete_profiles (athlete_id, medical_notes)
  values ('22222222-2222-2222-2222-222222222222', 'injected by a stranger');
  raise notice 'FAIL: a stranger wrote to someone else''s intake form';
exception when others then
  raise notice 'PASS: stranger cannot write another athlete''s intake form (%)', sqlerrm;
end $$;

-- Staff see every athlete: they are the ones reading it at practice.
select set_config('request.jwt.claim.sub', :coach, false);
do $$
declare n int;
begin
  select count(*) into n from athlete_profiles
   where athlete_id = '22222222-2222-2222-2222-222222222222';
  if n = 1 then raise notice 'PASS: coach can read athlete medical notes';
  else raise notice 'FAIL: coach cannot read medical notes';
  end if;
end $$;

-- Personal bests follow the same boundary.
select set_config('request.jwt.claim.sub', :athlete, false);
insert into personal_bests (athlete_id, event, result_seconds) values (:athlete, '5K', 1103);

select set_config('request.jwt.claim.sub', :newathlete, false);
do $$
declare n int;
begin
  select count(*) into n from personal_bests
   where athlete_id = '22222222-2222-2222-2222-222222222222';
  if n = 0 then raise notice 'PASS: another athlete cannot read personal bests';
  else raise notice 'FAIL: another athlete read % personal bests', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Meeting slots (0005).
-- ---------------------------------------------------------------------------

reset role;
insert into meeting_slots (id, starts_at, created_by) values
  ('77777777-7777-7777-7777-777777777777', now() + interval '3 days', :coach),
  ('88888888-8888-8888-8888-888888888888', now() + interval '4 days', :coach);
-- A time that has already gone by must not be bookable.
insert into meeting_slots (id, starts_at, created_by)
values ('99999999-9999-9999-9999-999999999999', now() - interval '1 day', :coach);

set role authenticated;

-- A family must not be able to invent their own slot.
select set_config('request.jwt.claim.sub', :parent, false);
do $$
begin
  insert into meeting_slots (starts_at, created_by)
  values (now() + interval '1 day', '33333333-3333-3333-3333-333333333333');
  raise notice 'FAIL: a parent created their own meeting slot';
exception when others then
  raise notice 'PASS: non-coach cannot create meeting slots (%)', sqlerrm;
end $$;

-- The parent books on behalf of their own athlete.
do $$
begin
  perform book_meeting_slot('77777777-7777-7777-7777-777777777777',
                            '22222222-2222-2222-2222-222222222222',
                            'Summer goals');
  raise notice 'PASS: parent booked a slot for their athlete';
exception when others then
  raise notice 'FAIL: parent could not book (%)', sqlerrm;
end $$;

do $$
begin
  perform book_meeting_slot('77777777-7777-7777-7777-777777777777',
                            '22222222-2222-2222-2222-222222222222');
  raise notice 'FAIL: a taken slot was booked twice';
exception when others then
  raise notice 'PASS: double booking rejected (%)', sqlerrm;
end $$;

do $$
begin
  perform book_meeting_slot('99999999-9999-9999-9999-999999999999',
                            '22222222-2222-2222-2222-222222222222');
  raise notice 'FAIL: a past slot was booked';
exception when others then
  raise notice 'PASS: past slot rejected (%)', sqlerrm;
end $$;

-- Booking for someone else's child is the attack that matters here.
select set_config('request.jwt.claim.sub', :newparent, false);
do $$
begin
  perform book_meeting_slot('88888888-8888-8888-8888-888888888888',
                            '22222222-2222-2222-2222-222222222222');
  raise notice 'FAIL: a stranger booked a meeting for another athlete';
exception when others then
  raise notice 'PASS: cannot book for an athlete you are not linked to (%)', sqlerrm;
end $$;

-- Another family sees the open time but not who took the booked one.
do $$
declare n_open int; n_taken int;
begin
  select count(*) into n_open from meeting_slots
   where id = '88888888-8888-8888-8888-888888888888';
  select count(*) into n_taken from meeting_slots
   where id = '77777777-7777-7777-7777-777777777777';
  if n_open = 1 and n_taken = 0
  then raise notice 'PASS: open slots are visible, other families'' bookings are not';
  else raise notice 'FAIL: slot visibility wrong (open %, taken %)', n_open, n_taken;
  end if;
end $$;

-- Cancelling releases the time instead of destroying it.
select set_config('request.jwt.claim.sub', :parent, false);
do $$
begin
  perform cancel_meeting_booking('77777777-7777-7777-7777-777777777777');
  if exists (select 1 from meeting_slots
              where id = '77777777-7777-7777-7777-777777777777' and booked_for is null)
  then raise notice 'PASS: cancelling returns the slot to the open pool';
  else raise notice 'FAIL: slot was not released';
  end if;
exception when others then
  raise notice 'FAIL: guardian could not cancel (%)', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Photos (0006). Pictures of minors: staff post, the clinic looks.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', :athlete, false);
do $$
begin
  insert into photos (storage_path, uploaded_by)
  values ('2026/sneaky.jpg', '22222222-2222-2222-2222-222222222222');
  raise notice 'FAIL: an athlete posted a photo';
exception when others then
  raise notice 'PASS: athletes cannot post photos (%)', sqlerrm;
end $$;

select set_config('request.jwt.claim.sub', :coach, false);
insert into photos (storage_path, caption, uploaded_by) values ('2026/team.jpg', 'Week one', :coach);

select set_config('request.jwt.claim.sub', :athlete, false);
do $$
declare n int;
begin
  select count(*) into n from photos where storage_path = '2026/team.jpg';
  if n = 1 then raise notice 'PASS: clinic members can see posted photos';
  else raise notice 'FAIL: athlete cannot see clinic photos';
  end if;
end $$;

reset role;
