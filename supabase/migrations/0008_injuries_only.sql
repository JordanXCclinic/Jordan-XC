-- The clinic collects less about a minor, not more.
--
-- Medical conditions, allergies and medication come out of the app entirely —
-- the coach gathers those from parents directly, which keeps the most sensitive
-- category of a child's information off a phone and out of this database.
--
-- Injuries stay, because they change what a coach asks an athlete to run today,
-- and they are the thing a training app has an actual reason to hold. The one
-- free-text field is split in two: what is wrong now, and what has happened
-- before. A coach at the trailhead needs the first at a glance.

alter table athlete_profiles drop column medical_notes;

alter table athlete_profiles add column current_injuries text;

comment on column athlete_profiles.current_injuries is
  'What is bothering the athlete right now. Shown first to staff, because it is
   what changes today''s session.';

comment on column athlete_profiles.injury_history is
  'Injuries that have healed. Context for a coach reading a pattern, not a
   reason to change today''s session.';

-- The in-app consent columns go with them. The clinic records guardian consent
-- by talking to parents, so leaving unused columns here would be dead schema
-- claiming a safeguard the app does not actually perform.
alter table athlete_profiles
  drop column guardian_consent_by,
  drop column guardian_consent_at;
