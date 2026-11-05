-- Pace groups.
--
-- The coach keeps each group's paces in a notebook at practice; the app only
-- says which group a runner is in, so a runner looks up their pace there. The
-- group belongs to the runner's place on a plan, not to the runner: a runner
-- can move up a group on a new plan without anything else changing.
--
-- Groups 1 to 5, or none. Writes go through the existing coach-only
-- plan_assignments policy; runners and their parents read it with the rest of
-- the assignment.

alter table plan_assignments
  add column pace_group smallint
  constraint plan_assignments_pace_group_range check (pace_group between 1 and 5);

comment on column plan_assignments.pace_group is
  'The runner''s pace group on this plan, 1 to 5. The paces themselves are kept at practice, not in the app.';
