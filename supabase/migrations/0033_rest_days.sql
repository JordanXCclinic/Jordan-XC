-- Rest days.
--
-- A day with nothing written used to mean two things: a rest day, or a day the
-- coach had not got to yet. The coach now marks a rest day as a workout of its
-- own, so a week with all seven days written is a finished week, and the plans
-- list can show which plans have next week ready.
--
-- A rest day is still a workouts row (same unique week and day), with rest set.
-- Runners see it as a rest day with nothing to log; it carries no splits.

alter table workouts add column rest boolean not null default false;

alter table workouts add constraint workouts_rest_has_no_splits
  check (not rest or split_count is null);

comment on column workouts.rest is
  'A rest day: written on purpose, so the week counts as complete, with nothing to log.';
