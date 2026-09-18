-- Two holes between what the app promises and what the database enforces.
--
-- 1. Every practice, announcement, post and photo already carries an audience,
--    and a coach picks one when posting — but nothing ever read it. A "Coaches
--    only" announcement was visible to every athlete in the clinic, and a
--    one-on-one client saw the whole summer group's content. The control was
--    real in the UI and imaginary in the database.
--
-- 2. Parents could not log a run. Plenty of these athletes have no phone, so a
--    parent entering the run is not an edge case — without it those athletes
--    simply have no training history.

-- ---------------------------------------------------------------------------
-- Who an audience reaches.
-- ---------------------------------------------------------------------------

-- Written once and called from every policy, so the rule cannot drift between
-- practices and announcements.
--
-- A parent sees whatever their own athletes see, which is what makes a
-- one-on-one client's parent see private content and nothing from the clinic.
-- 'everyone' means everyone, because that is what the coach picked.
create or replace function can_see_audience(uid uuid, aud audience)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when uid is null then false
    when is_coach(uid) then true
    when aud = 'coaches' then false
    when aud = 'everyone' then exists (select 1 from profiles where id = uid)
    when aud = 'clinic' then
      exists (select 1 from profiles where id = uid and role = 'athlete')
      or exists (select 1 from guardian_links g
                   join profiles a on a.id = g.athlete_id
                  where g.guardian_id = uid and a.role = 'athlete')
    when aud = 'private' then
      exists (select 1 from profiles where id = uid and role = 'private_client')
      or exists (select 1 from guardian_links g
                   join profiles a on a.id = g.athlete_id
                  where g.guardian_id = uid and a.role = 'private_client')
    else false
  end;
$$;

drop policy practices_select on practices;
create policy practices_select on practices for select
  using (can_see_audience(auth.uid(), audience));

drop policy announcements_select on announcements;
create policy announcements_select on announcements for select
  using (
    (published_at is not null and can_see_audience(auth.uid(), audience))
    or is_coach(auth.uid())
  );

drop policy posts_select on posts;
create policy posts_select on posts for select
  using (
    (published_at is not null and can_see_audience(auth.uid(), audience))
    or is_coach(auth.uid())
  );

drop policy photos_select on photos;
create policy photos_select on photos for select
  using (can_see_audience(auth.uid(), audience));

-- ---------------------------------------------------------------------------
-- Parents logging runs.
-- ---------------------------------------------------------------------------

alter table workout_logs
  add column logged_by uuid references profiles on delete set null;

comment on column workout_logs.logged_by is
  'Who entered the log. Differs from athlete_id when a parent entered it for
   their athlete, which the coach''s view shows.';

-- Set server-side rather than trusted from the client, so attribution cannot be
-- forged by posting someone else''s id.
create or replace function stamp_workout_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.logged_by := auth.uid();
  return new;
end;
$$;

create trigger workout_logs_stamp
  before insert or update on workout_logs
  for each row execute function stamp_workout_log();

-- The athlete, or a guardian linked to them. Deliberately not coaches: the
-- training log is the athlete's own account of the run, and a coach writing
-- into it would make "who has logged this week" meaningless.
drop policy workout_logs_write on workout_logs;
create policy workout_logs_write on workout_logs for all
  using (
    athlete_id = auth.uid()
    or exists (select 1 from guardian_links
                where athlete_id = workout_logs.athlete_id
                  and guardian_id = auth.uid())
  )
  with check (
    athlete_id = auth.uid()
    or exists (select 1 from guardian_links
                where athlete_id = workout_logs.athlete_id
                  and guardian_id = auth.uid())
  );
