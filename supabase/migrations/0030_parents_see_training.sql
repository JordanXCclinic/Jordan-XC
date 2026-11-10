-- Parents see their runner's training.
--
-- Plans and workouts were readable by staff and by the runner on the plan
-- (athlete_id = auth.uid()) and nobody else. A parent could read the
-- assignment, through can_view_athlete(), but not the plan or the workouts it
-- pointed to, so the Training and Home tabs showed nothing. For a runner
-- without a phone, whose only way into the app is a parent's account, that
-- meant no training at all.
--
-- Now a plan or workout is readable by whoever can view a runner assigned to
-- it: the runner, their parents, and staff, by the one function that decides
-- who sees an athlete. Writes stay with staff.

drop policy training_plans_select on training_plans;
create policy training_plans_select on training_plans for select
  using (
    is_coach(auth.uid())
    or exists (select 1 from plan_assignments a
                where a.plan_id = training_plans.id
                  and can_view_athlete(auth.uid(), a.athlete_id))
  );

drop policy workouts_select on workouts;
create policy workouts_select on workouts for select
  using (
    is_coach(auth.uid())
    or exists (select 1 from plan_assignments a
                where a.plan_id = workouts.plan_id
                  and can_view_athlete(auth.uid(), a.athlete_id))
  );
