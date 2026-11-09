-- A start date for the plan itself.
--
-- The start date used to live only on each runner's assignment, and the plan
-- screen offered "next Monday" every time it was opened. So runners assigned on
-- different days got different weeks, and the screen had no way to show which
-- calendar week "week 3" was.
--
-- Now the plan carries the Monday its week 1 begins. The coach picks it from a
-- calendar; the app writes it here and to every assignment on the plan, so the
-- whole group runs the same weeks. Assignments keep their own starts_on, which
-- is what runners read, so nothing on their side changes.
--
-- Writes go through the existing coach-only training_plans policy.

alter table training_plans add column starts_on date;

comment on column training_plans.starts_on is
  'The day week 1 of this plan begins. Copied to every plan_assignments.starts_on on the plan when it changes.';

-- Existing plans take the start most of their runners already have, the later
-- date on a tie. A plan nobody is on yet stays empty until the coach picks one.
update training_plans p
   set starts_on = s.starts_on
  from (
    select distinct on (plan_id) plan_id, starts_on
      from plan_assignments
     group by plan_id, starts_on
     order by plan_id, count(*) desc, starts_on desc
  ) s
 where s.plan_id = p.id;
