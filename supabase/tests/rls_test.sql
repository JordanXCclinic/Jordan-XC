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

-- Assistants run practices and write training, but only the head coach hands
-- out access to the clinic.
reset role;
insert into auth.users (id) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
insert into profiles (id, full_name, role)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Brody Ahlemeyer', 'coach');

set role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false);
do $$
begin
  perform create_family_codes('Someone New', '2026');
  raise notice 'FAIL: an assistant coach issued a clinic code';
exception when others then
  raise notice 'PASS: an assistant coach cannot issue clinic codes (%)', sqlerrm;
end $$;

do $$
declare n int;
begin
  select count(*) into n from invite_codes;
  if n = 0 then raise notice 'PASS: an assistant coach cannot read the code table';
  else raise notice 'FAIL: an assistant read % invite codes', n;
  end if;
end $$;

-- They still have every other staff power.
do $$
begin
  insert into practices (starts_at, location_name, created_by)
  values (now() + interval '9 days', 'Veterans Park', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
  raise notice 'PASS: an assistant coach can still post a practice';
exception when others then
  raise notice 'FAIL: an assistant coach could not post a practice (%)', sqlerrm;
end $$;

select set_config('request.jwt.claim.sub', :coach, false);

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
-- Intake forms (0004, narrowed by 0008 and 0009).
--
-- athlete 22… and parent 33… are linked. athlete 55… is a real, unrelated
-- athlete — a better probe than a user with no profile at all, because it is
-- the case that actually happens: two families in the same clinic.
-- ---------------------------------------------------------------------------

set role authenticated;
select set_config('request.jwt.claim.sub', :athlete, false);

do $$
begin
  insert into athlete_profiles (athlete_id, school, grade, emergency_contact_name, emergency_contact_phone)
  values (auth.uid(), 'Mountain Brook', '9th', 'Pat Runner', '205-555-0134');
  raise notice 'PASS: athlete can fill in their own intake form';
exception when others then
  raise notice 'FAIL: athlete cannot write own intake form (%)', sqlerrm;
end $$;

-- Guardians fill these in for younger runners, so they get write access too.
select set_config('request.jwt.claim.sub', :parent, false);
do $$
declare v_notes text;
begin
  select emergency_contact_phone into v_notes from athlete_profiles
   where athlete_id = '22222222-2222-2222-2222-222222222222';
  if v_notes = '205-555-0134'
  then raise notice 'PASS: parent can read their athlete''s emergency contact';
  else raise notice 'FAIL: parent could not read the emergency contact (got %)', coalesce(v_notes, 'null');
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
  if n = 0 then raise notice 'PASS: another athlete cannot read the intake form';
  else raise notice 'FAIL: another athlete read % intake rows', n;
  end if;
end $$;

do $$
begin
  insert into athlete_profiles (athlete_id, school)
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
  if n = 1 then raise notice 'PASS: coach can read an athlete''s intake form';
  else raise notice 'FAIL: coach cannot read the intake form';
  end if;
end $$;

-- Finishing setup writes the athlete's own name, phone, and onboarded_at in one
-- statement. That is the exact update the app makes, and the column grants have
-- to allow it without opening a door to role.
select set_config('request.jwt.claim.sub', :athlete, false);
do $$
begin
  update profiles
     set full_name = 'Sam Runner', phone = '205-555-0134', onboarded_at = now()
   where id = auth.uid();
  raise notice 'PASS: athlete can finish their own setup';
exception when others then
  raise notice 'FAIL: athlete cannot complete setup (%)', sqlerrm;
end $$;

do $$
begin
  update profiles set onboarded_at = now(), role = 'coach' where id = auth.uid();
  raise notice 'FAIL: role rode along with an onboarding update';
exception when others then
  raise notice 'PASS: role still cannot ride along with setup (%)', sqlerrm;
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

-- The clinic handles injuries, conditions, allergies and medication with parents
-- directly. The app holds no health information at all, and there must be
-- nowhere in the schema to put any — this is what lets both stores be told the
-- app collects no health data.
reset role;
do $$
declare n int; cols text;
begin
  select count(*), string_agg(column_name, ', ') into n, cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'athlete_profiles'
     and column_name in ('medical_notes', 'medical_conditions', 'allergies',
                         'medications', 'injury_history', 'current_injuries',
                         'physician', 'conditions');
  if n = 0 then raise notice 'PASS: the schema has nowhere to store health information';
  else raise notice 'FAIL: health column(s) came back into athlete_profiles: %', cols;
  end if;
end $$;
set role authenticated;

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

-- ---------------------------------------------------------------------------
-- Audience scoping and parent-entered logs (0010).
--
-- athlete 22… is a clinic athlete with parent 33…. newathlete 55… is also a
-- clinic athlete. A one-on-one client is added here so the two programmes can
-- be tested against each other, which is the isolation that matters.
-- ---------------------------------------------------------------------------

reset role;

\set solo '''cccccccc-cccc-cccc-cccc-cccccccccccc'''
insert into auth.users (id) values (:solo);
insert into profiles (id, full_name, role) values (:solo, 'Lena Marsh', 'private_client');

insert into announcements (id, author_id, title, body, audience, published_at) values
  ('d0000000-0000-0000-0000-000000000001', :coach, 'Clinic news',   'x', 'clinic',   now()),
  ('d0000000-0000-0000-0000-000000000002', :coach, 'Private note',  'x', 'private',  now()),
  ('d0000000-0000-0000-0000-000000000003', :coach, 'Staff only',    'x', 'coaches',  now()),
  ('d0000000-0000-0000-0000-000000000004', :coach, 'For everyone',  'x', 'everyone', now());

insert into practices (id, starts_at, location_name, created_by, audience) values
  ('d0000000-0000-0000-0000-000000000011', now() + interval '2 days', 'Jemison Trail', :coach, 'clinic'),
  ('d0000000-0000-0000-0000-000000000012', now() + interval '3 days', 'Track',         :coach, 'private');

set role authenticated;

-- A clinic athlete sees clinic and everyone, and neither the private content
-- nor anything marked for staff.
select set_config('request.jwt.claim.sub', :athlete, false);
do $$
declare n_clinic int; n_private int; n_staff int; n_all int;
begin
  select count(*) into n_clinic  from announcements where audience = 'clinic';
  select count(*) into n_private from announcements where audience = 'private';
  select count(*) into n_staff   from announcements where audience = 'coaches';
  select count(*) into n_all     from announcements where audience = 'everyone';
  if n_clinic = 1 and n_private = 0 and n_staff = 0 and n_all = 1
  then raise notice 'PASS: a clinic athlete sees clinic and everyone, not private or staff';
  else raise notice 'FAIL: clinic athlete saw clinic %, private %, staff %, everyone %',
       n_clinic, n_private, n_staff, n_all;
  end if;
end $$;

-- The isolation the clinic actually cares about, in both directions.
select set_config('request.jwt.claim.sub', :solo, false);
do $$
declare n_clinic int; n_private int; n_practice_clinic int;
begin
  select count(*) into n_clinic  from announcements where audience = 'clinic';
  select count(*) into n_private from announcements where audience = 'private';
  select count(*) into n_practice_clinic from practices where audience = 'clinic';
  if n_clinic = 0 and n_private = 1 and n_practice_clinic = 0
  then raise notice 'PASS: a one-on-one client sees their own content and none of the clinic''s';
  else raise notice 'FAIL: one-on-one saw clinic %, private %, clinic practices %',
       n_clinic, n_private, n_practice_clinic;
  end if;
end $$;

-- A parent inherits their own athlete's view, not the other programme's.
select set_config('request.jwt.claim.sub', :parent, false);
do $$
declare n_clinic int; n_private int; n_staff int;
begin
  select count(*) into n_clinic  from announcements where audience = 'clinic';
  select count(*) into n_private from announcements where audience = 'private';
  select count(*) into n_staff   from announcements where audience = 'coaches';
  if n_clinic = 1 and n_private = 0 and n_staff = 0
  then raise notice 'PASS: a parent sees exactly what their own athlete sees';
  else raise notice 'FAIL: parent saw clinic %, private %, staff %', n_clinic, n_private, n_staff;
  end if;
end $$;

-- Staff see everything, including what is addressed only to them.
select set_config('request.jwt.claim.sub', :coach, false);
do $$
declare n int;
begin
  select count(*) into n from announcements
   where id in ('d0000000-0000-0000-0000-000000000001',
                'd0000000-0000-0000-0000-000000000002',
                'd0000000-0000-0000-0000-000000000003',
                'd0000000-0000-0000-0000-000000000004');
  if n = 4 then raise notice 'PASS: staff see every audience including their own';
  else raise notice 'FAIL: coach saw % of 4 announcements', n;
  end if;
end $$;

-- Parent-entered training logs.
reset role;
insert into training_plans (id, name, created_by)
values ('d0000000-0000-0000-0000-000000000021', 'Summer base', :coach);
insert into workouts (id, plan_id, week_number, day_of_week, title)
values ('d0000000-0000-0000-0000-000000000022',
        'd0000000-0000-0000-0000-000000000021', 1, 1, 'Easy 4 miles');

set role authenticated;
select set_config('request.jwt.claim.sub', :parent, false);
do $$
begin
  insert into workout_logs (athlete_id, workout_id, logged_on, distance_miles)
  values ('22222222-2222-2222-2222-222222222222',
          'd0000000-0000-0000-0000-000000000022', current_date, 4);
  raise notice 'PASS: a parent can log a run for their own athlete';
exception when others then
  raise notice 'FAIL: parent could not log for their athlete (%)', sqlerrm;
end $$;

-- Attribution is stamped server-side, so it cannot be passed off as the athlete's.
reset role;
do $$
declare v_by uuid;
begin
  select logged_by into v_by from workout_logs
   where athlete_id = '22222222-2222-2222-2222-222222222222'
     and workout_id = 'd0000000-0000-0000-0000-000000000022';
  if v_by = '33333333-3333-3333-3333-333333333333'
  then raise notice 'PASS: the log records the parent who entered it';
  else raise notice 'FAIL: logged_by was % rather than the parent', coalesce(v_by::text, 'null');
  end if;
end $$;

-- Someone else's parent must not be able to write into an athlete's log.
set role authenticated;
select set_config('request.jwt.claim.sub', :newparent, false);
do $$
begin
  insert into workout_logs (athlete_id, logged_on, distance_miles)
  values ('22222222-2222-2222-2222-222222222222', current_date, 99);
  raise notice 'FAIL: an unrelated parent logged a run for another athlete';
exception when others then
  raise notice 'PASS: an unrelated parent cannot log for another athlete (%)', sqlerrm;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- One-on-one isolation between private clients (0013).
--
-- solo (Lena) and solo2 (Maya) are both one-on-one clients. They pay for
-- individual coaching and have no connection to each other, so content for one
-- must never reach the other — the failure the single 'private' bucket had.
-- ---------------------------------------------------------------------------

reset role;

\set solo2 '''dddddddd-dddd-dddd-dddd-dddddddddddd'''
\set soloparent '''dddddddd-1111-1111-1111-111111111111'''
insert into auth.users (id) values (:solo2), (:soloparent);
insert into profiles (id, full_name, role) values
  (:solo2, 'Maya Ellis', 'private_client'),
  (:soloparent, 'Jo Marsh', 'parent');
insert into guardian_links (athlete_id, guardian_id) values (:solo, :soloparent);

insert into announcements (id, author_id, title, body, audience, audience_athlete_id, published_at) values
  ('e0000000-0000-0000-0000-000000000001', :coach, 'For Lena', 'x', 'private', :solo,  now()),
  ('e0000000-0000-0000-0000-000000000002', :coach, 'For Maya', 'x', 'private', :solo2, now());

insert into practices (id, starts_at, location_name, created_by, audience, audience_athlete_id)
values ('e0000000-0000-0000-0000-000000000011', now() + interval '2 days',
        'Track — Lena only', :coach, 'private', :solo);

set role authenticated;

select set_config('request.jwt.claim.sub', :solo, false);
do $$
declare n_mine int; n_theirs int; n_practice int;
begin
  select count(*) into n_mine   from announcements where id = 'e0000000-0000-0000-0000-000000000001';
  select count(*) into n_theirs from announcements where id = 'e0000000-0000-0000-0000-000000000002';
  select count(*) into n_practice from practices where id = 'e0000000-0000-0000-0000-000000000011';
  if n_mine = 1 and n_theirs = 0 and n_practice = 1
  then raise notice 'PASS: a one-on-one client sees their own content and not another client''s';
  else raise notice 'FAIL: mine %, theirs %, practice %', n_mine, n_theirs, n_practice;
  end if;
end $$;

select set_config('request.jwt.claim.sub', :solo2, false);
do $$
declare n_mine int; n_theirs int; n_practice int;
begin
  select count(*) into n_mine   from announcements where id = 'e0000000-0000-0000-0000-000000000002';
  select count(*) into n_theirs from announcements where id = 'e0000000-0000-0000-0000-000000000001';
  select count(*) into n_practice from practices where id = 'e0000000-0000-0000-0000-000000000011';
  if n_mine = 1 and n_theirs = 0 and n_practice = 0
  then raise notice 'PASS: the isolation holds in the other direction too';
  else raise notice 'FAIL: mine %, theirs %, practice %', n_mine, n_theirs, n_practice;
  end if;
end $$;

-- A private client's own parent still sees their athlete's content.
select set_config('request.jwt.claim.sub', :soloparent, false);
do $$
declare n_mine int; n_theirs int;
begin
  select count(*) into n_mine   from announcements where id = 'e0000000-0000-0000-0000-000000000001';
  select count(*) into n_theirs from announcements where id = 'e0000000-0000-0000-0000-000000000002';
  if n_mine = 1 and n_theirs = 0
  then raise notice 'PASS: a one-on-one client''s parent sees their athlete''s content and no other client''s';
  else raise notice 'FAIL: parent saw mine %, theirs %', n_mine, n_theirs;
  end if;
end $$;

-- And a clinic athlete sees neither.
select set_config('request.jwt.claim.sub', :newathlete, false);
do $$
declare n int;
begin
  select count(*) into n from announcements
   where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002');
  if n = 0 then raise notice 'PASS: a clinic athlete sees no one-on-one content at all';
  else raise notice 'FAIL: a clinic athlete saw % private announcements', n;
  end if;
end $$;

-- A push for one client must not reach the other.
reset role;
update profiles set push_token = 'ExponentPushToken[maya]',
       notification_prefs = '{"announcements": true}'::jsonb where id = :solo2;
do $$
declare n_for_maya int; n_for_lena int;
begin
  select count(*) into n_for_maya from push_recipients('private', 'announcements',
                                     'dddddddd-dddd-dddd-dddd-dddddddddddd');
  select count(*) into n_for_lena from push_recipients('private', 'announcements',
                                     'cccccccc-cccc-cccc-cccc-cccccccccccc');
  if n_for_maya = 1 and n_for_lena = 0
  then raise notice 'PASS: a push for one client does not reach the other';
  else raise notice 'FAIL: push reach wrong (maya %, lena %)', n_for_maya, n_for_lena;
  end if;
end $$;

set role authenticated;
reset role;

-- ---------------------------------------------------------------------------
-- Push recipients (0012).
-- ---------------------------------------------------------------------------

reset role;
update profiles set push_token = 'ExponentPushToken[clinic-athlete]'
 where id = '22222222-2222-2222-2222-222222222222';
update profiles set push_token = 'ExponentPushToken[solo]',
       notification_prefs = '{"announcements": true}'::jsonb
 where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Without a named athlete the audience still decides it. Two one-on-one
-- clients are subscribed by this point, and a broadcast to the programme
-- reaches both of them; the clinic athlete is not one of them.
do $$
declare n_clinic int; n_private int;
begin
  select count(*) into n_clinic from push_recipients('clinic', 'announcements');
  select count(*) into n_private from push_recipients('private', 'announcements');
  if n_clinic = 1 and n_private = 2
  then raise notice 'PASS: a push goes to the programme it was addressed to';
  else raise notice 'FAIL: recipients wrong (clinic %, private %)', n_clinic, n_private;
  end if;
end $$;

-- A category switched off means no push, even though the row stays readable.
update profiles set notification_prefs = '{"announcements": false}'::jsonb
 where id = '22222222-2222-2222-2222-222222222222';
do $$
declare n int;
begin
  select count(*) into n from push_recipients('clinic', 'announcements');
  if n = 0 then raise notice 'PASS: switching a category off stops the push';
  else raise notice 'FAIL: % recipient(s) after switching the category off', n;
  end if;
end $$;

-- The token list must not be reachable with the app's own key: it would hand
-- any signed-in athlete every family's push token.
set role authenticated;
select set_config('request.jwt.claim.sub', :athlete, false);
do $$
begin
  perform push_recipients('clinic', 'announcements');
  raise notice 'FAIL: a signed-in athlete enumerated the clinic''s push tokens';
exception when others then
  raise notice 'PASS: push tokens are not reachable with the app key (%)', sqlerrm;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Account deletion, export, and the intake-form access trail (0007).
--
-- Apple will not approve an app that creates accounts but cannot delete them,
-- so these pin the behaviour rather than just the permission.
-- ---------------------------------------------------------------------------

set role authenticated;

-- A staff read of an intake form is recorded; the family reading their own is not.
select set_config('request.jwt.claim.sub', :coach, false);
select staff_view_athlete_profile(:athlete);

select set_config('request.jwt.claim.sub', :athlete, false);
select staff_view_athlete_profile(:athlete);

reset role;
do $$
declare n_staff int; n_self int;
begin
  select count(*) into n_staff from audit_log
   where action = 'read' and record_id = '22222222-2222-2222-2222-222222222222'
     and actor_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into n_self from audit_log
   where action = 'read' and record_id = '22222222-2222-2222-2222-222222222222'
     and actor_id = '22222222-2222-2222-2222-222222222222';
  if n_staff = 1 and n_self = 0
  then raise notice 'PASS: staff reads of an intake form are logged, the athlete''s own are not';
  else raise notice 'FAIL: audit trail wrong (staff %, self %)', n_staff, n_self;
  end if;
end $$;

-- An unrelated athlete cannot read the record through the logging function either.
set role authenticated;
select set_config('request.jwt.claim.sub', :newathlete, false);
do $$
begin
  perform staff_view_athlete_profile('22222222-2222-2222-2222-222222222222');
  raise notice 'FAIL: the audit wrapper leaked another athlete''s record';
exception when others then
  raise notice 'PASS: the audit wrapper still refuses an unrelated athlete (%)', sqlerrm;
end $$;

-- Export hands a family their own data and nobody else's.
select set_config('request.jwt.claim.sub', :athlete, false);
do $$
declare v jsonb;
begin
  v := export_my_data();
  if v -> 'account' ->> 'id' = '22222222-2222-2222-2222-222222222222'
     and v -> 'athlete_profile' ->> 'school' = 'Mountain Brook'
  then raise notice 'PASS: export returns the signed-in family''s own record';
  else raise notice 'FAIL: export payload wrong (%)', v;
  end if;
end $$;

-- Deleting an athlete account really removes the athlete, the intake form, the
-- personal bests and the guardian link — not just a flag.
select set_config('request.jwt.claim.sub', :athlete, false);
select delete_my_account();

reset role;
do $$
declare n_profile int; n_intake int; n_pb int; n_link int; n_user int;
begin
  select count(*) into n_profile from profiles where id = '22222222-2222-2222-2222-222222222222';
  select count(*) into n_intake from athlete_profiles where athlete_id = '22222222-2222-2222-2222-222222222222';
  select count(*) into n_pb from personal_bests where athlete_id = '22222222-2222-2222-2222-222222222222';
  select count(*) into n_link from guardian_links where athlete_id = '22222222-2222-2222-2222-222222222222';
  select count(*) into n_user from auth.users where id = '22222222-2222-2222-2222-222222222222';
  if n_profile = 0 and n_intake = 0 and n_pb = 0 and n_link = 0 and n_user = 0
  then raise notice 'PASS: deleting an account removes the profile, intake form, bests and links';
  else raise notice 'FAIL: data survived deletion (profile %, intake %, pb %, link %, user %)',
       n_profile, n_intake, n_pb, n_link, n_user;
  end if;
end $$;

-- The assistant added earlier has served his purpose. Retiring him here keeps
-- the reassignment test below about one departing coach and one heir, rather
-- than about which of several staff happens to be oldest.
delete from practices where created_by = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
delete from auth.users where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

-- The clinic's own records outlive a coach, and are handed to another coach
-- rather than blocking the deletion or vanishing with them.
insert into auth.users (id) values ('aaaaaaaa-1111-1111-1111-111111111111');
insert into profiles (id, full_name, role) values ('aaaaaaaa-1111-1111-1111-111111111111', 'Bela Doss', 'coach');
insert into practices (id, starts_at, location_name, created_by)
values ('bbbbbbbb-1111-1111-1111-111111111111', now() + interval '2 days', 'Jemison Trail', :coach);

set role authenticated;
select set_config('request.jwt.claim.sub', :coach, false);
select delete_my_account();

reset role;
do $$
declare v_owner uuid; n_coach int;
begin
  select created_by into v_owner from practices where id = 'bbbbbbbb-1111-1111-1111-111111111111';
  select count(*) into n_coach from profiles where id = '11111111-1111-1111-1111-111111111111';
  if v_owner = 'aaaaaaaa-1111-1111-1111-111111111111' and n_coach = 0
  then raise notice 'PASS: a departing coach''s practices pass to the remaining coach';
  else raise notice 'FAIL: reassignment wrong (owner %, coach rows %)', v_owner, n_coach;
  end if;
end $$;

-- The last coach cannot delete the clinic out from under everyone by accident.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-1111-1111-111111111111', false);
do $$
begin
  perform delete_my_account();
  raise notice 'FAIL: the only coach deleted themselves and orphaned the clinic';
exception when others then
  raise notice 'PASS: the only coach is told to add another coach first (%)', sqlerrm;
end $$;

reset role;
